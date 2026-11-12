import { handleLocal } from '@/server/phare-local';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ parts: string[] }> };
async function handle(req: Request, context: Context) { return handleLocal(req, (await context.params).parts); }
export const GET = handle;
export const HEAD = handle;
export const PUT = handle;
export const POST = handle;
