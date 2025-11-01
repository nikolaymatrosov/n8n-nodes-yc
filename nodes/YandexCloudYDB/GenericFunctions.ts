import { Driver } from '@ydbjs/core';
import { query } from '@ydbjs/query';
import { fromJs, toJs } from '@ydbjs/value';
import { IamTokenService } from '@yandex-cloud/nodejs-sdk/dist/token-service/iam-token-service';
import { mapKeys, camelCase } from 'lodash';
import type { YDBQueryParams } from './types';
import { type CallOptions, type ClientMiddlewareCall, Metadata } from 'nice-grpc'

interface IIAmCredentials {
	serviceAccountId: string;
	accessKeyId: string;
	privateKey: string;
}

/**
 * Converts a Yandex Cloud service account key JSON to IIAmCredentials format
 */
export function parseServiceAccountJson(jsonString: string): IIAmCredentials {
	const parsed = JSON.parse(jsonString);

	// Convert all keys to camelCase
	const camelCased = mapKeys(parsed, (_value, key) => camelCase(key));

	// Map the Yandex Cloud format to the expected format
	return {
		serviceAccountId: camelCased.serviceAccountId || '',
		accessKeyId: camelCased.id || camelCased.accessKeyId || '',
		privateKey: camelCased.privateKey || '',
	};
}

/**
 * Create YDB Driver with IAM authentication
 */
export async function createYDBDriver(
	serviceAccountJson: IIAmCredentials,
	endpoint: string,
	database: string,
): Promise<Driver> {
	// Create IAM token service to get token
	const iamTokenService = new IamTokenService(serviceAccountJson);

	// Get IAM token
	const iamToken = await iamTokenService.getToken();

	// Create credentials provider with IAM token
	const credentialsProvider = new AccessTokenCredentialsProvider({
		token: iamToken,
	});

	// Create driver with authentication
	const driver = new Driver(`${endpoint}${database}`, {
		credentialsProvider: credentialsProvider as any,
	});

	// Wait for driver to be ready
	await driver.ready();

	return driver;
}

/**
 * Execute YQL query with parameters
 */
export async function executeYQLQuery(
	driver: Driver,
	yqlQuery: string,
	params?: YDBQueryParams,
): Promise<any[][]> {
	const sql = query(driver);

	// If no parameters, execute simple query
	if (!params || Object.keys(params).length === 0) {
		const resultSets = await sql([yqlQuery] as any);
		// Results are already in JavaScript format by default
		return resultSets;
	}

	// Execute parameterized query
	// Build query with parameters using tagged template
	let queryBuilder = sql([yqlQuery] as any);

	// Add parameters
	for (const [name, value] of Object.entries(params)) {
		queryBuilder = queryBuilder.parameter(name, fromJs(value));
	}

	const resultSets = await queryBuilder;

	// Results are already in JavaScript format by default
	return resultSets;
}

/**
 * Close YDB driver connection
 */
export async function closeYDBDriver(driver: Driver): Promise<void> {
	await driver.close();
}

/**
 * Convert JavaScript value to YDB value
 */
export function jsToYDB(value: any): any {
	return fromJs(value);
}

/**
 * Convert YDB value to JavaScript
 */
export function ydbToJS(value: any): any {
	return toJs(value);
}

export abstract class CredentialsProvider {
	constructor() {
		// @ts-expect-error Inside middleware perform `this.getToken` call
		// to get the token. This is a workaround for the fact that
		// `this` is not bound to the class instance inside the middleware.
		this.middleware = this.middleware.bind(this)
	}

	abstract getToken(force?: boolean, signal?: AbortSignal): Promise<string>

	readonly middleware = async function* <Request = unknown, Response = unknown>(
		this: CredentialsProvider,
		call: ClientMiddlewareCall<Request, Response>,
		options: CallOptions
	) {
		let token = await this.getToken(false, options.signal as AbortSignal | undefined)

		return yield* call.next(call.request, {
			...options,
			metadata: Metadata(options.metadata).set('x-ydb-auth-ticket', token),
		})
	}
}

export type AccessTokenCredentials = {
	// TODO: support read from file
	// source: 'file' | 'inline'
	token: string
}

/**
 * Provides access token-based authentication credentials.
 *
 * @class AccessTokenCredentialsProvider
 * @extends CredentialsProvider
 */
export class AccessTokenCredentialsProvider extends CredentialsProvider {
	#token: string

	constructor(credentials: AccessTokenCredentials) {
		super()
		this.#token = credentials.token
	}

	/**
	 * Returns the token from the credentials.
	 * @param force - ignored
	 * @param signal - ignored
	 * @returns the token
	 */
	getToken(): Promise<string> {
		return Promise.resolve(this.#token)
	}
}
