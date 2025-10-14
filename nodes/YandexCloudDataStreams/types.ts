/**
 * Interface for shard iterator storage in trigger node context
 */
export interface ShardIterators {
	[shardId: string]: string;
}

/**
 * Interface for shard information
 */
export interface ShardInfo {
	shardId: string;
	parentShardId?: string;
	adjacentParentShardId?: string;
	hashKeyRange?: {
		startingHashKey: string;
		endingHashKey: string;
	};
	sequenceNumberRange?: {
		startingSequenceNumber: string;
		endingSequenceNumber?: string;
	};
}

/**
 * Record data structure for Put Multiple Records operation
 */
export interface RecordData {
	data: string;
	partitionKey: string;
	explicitHashKey?: string;
}

/**
 * Result structure for Put Record operation
 */
export interface PutRecordResult {
	success: boolean;
	shardId?: string;
	sequenceNumber?: string;
	encryptionType?: string;
	error?: string;
}

/**
 * Result structure for individual record in Put Records operation
 */
export interface PutRecordsRecordResult {
	shardId?: string;
	sequenceNumber?: string;
	success: boolean;
	errorCode?: string;
	errorMessage?: string;
}

/**
 * Result structure for Put Records operation
 */
export interface PutRecordsResult {
	success: boolean;
	successCount: number;
	failedCount: number;
	records: PutRecordsRecordResult[];
}

/**
 * Output format for trigger node records
 */
export interface TriggerRecordOutput {
	data: any;
	metadata?: {
		sequenceNumber: string;
		approximateArrivalTimestamp: Date;
		partitionKey: string;
		shardId: string;
	};
}

