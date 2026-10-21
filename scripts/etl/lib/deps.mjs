/**
 * ETL 依赖出口（集中一处，方便换实现/排障）。
 * 注意：pg-copy-streams v7 把 fromCopy/toCopy 改名为 from/to。
 */
export { default as pg } from 'pg';
export { from as copyFrom, to as copyTo } from 'pg-copy-streams';
