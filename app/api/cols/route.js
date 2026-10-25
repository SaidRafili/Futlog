import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { rows } = await query(
    `select column_name, data_type from information_schema.columns
     where table_name = 'fixtures' order by ordinal_position`
  );
  return Response.json(rows);
}
