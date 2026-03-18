declare module 'postgres' {
  type TaggedResult<T = unknown> = Promise<T>;

  interface SqlClient {
    <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): TaggedResult<T>;
    begin<T = unknown>(fn: (sql: SqlClient) => Promise<T>): Promise<T>;
  }

  function postgres(url: string, options?: Record<string, unknown>): SqlClient;
  export default postgres;
}
