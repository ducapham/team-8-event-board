import type { Result } from "../lib/result";
import type { IEventRecord } from "./Event";
import type { EventError } from "./errors";

export interface IEventRepository {
  create(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
  listEvents(): Promise<Result<IEventRecord[], EventError>>;
  findById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  save(event: IEventRecord): Promise<Result<IEventRecord, EventError>>;
}