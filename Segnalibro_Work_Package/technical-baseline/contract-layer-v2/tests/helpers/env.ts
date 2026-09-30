function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for DB contract tests. Copy .env.contract.example or export the value printed by \"supabase status\".`,
    );
  }
  return value;
}

export function dbTestEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    dbUrl:
      process.env.SUPABASE_DB_URL ??
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  };
}
