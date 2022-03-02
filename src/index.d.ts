/// <reference types="node" />

import { Kafka } from 'kafkajs';

declare class KafkaTestHelper {
    constructor(kafka: Kafka, topic: string)
    static create(kafka: Kafka, topic: string): Promise<KafkaTestHelper>;
    reset (): Promise<void>;
    ensureTopicExists (timeout: number | null): Promise<void>;
    ensureTopicDeleted (timeout: number | null): Promise<void>;
    messages (): Promise<ConsumedMessage[]>;
    publishMessages (messages: ProducibleMessage[]): Promise<void>;
}

export interface ConsumedMessage {
    headers: Object;
    partition: number;
    buffer: Buffer;
    json: Object;
    string: string;
}

export type ProducibleMessage = {
    partition: number;
    key: string;
    buffer: Buffer;
    json: Object;
    string: string;
}

export declare function createKafkaTestHelper(kafka: Kafka, topic: string): Promise<KafkaTestHelper>;