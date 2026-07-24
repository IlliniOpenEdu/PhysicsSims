import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event_name, sim_id, course, session_id, metadata } = req.body;

  if (!event_name) return res.status(400).json({ error: 'event_name required' });

  const { error } = await supabase.from('events').insert({
    event_name,
    sim_id,
    course,
    session_id,
    metadata,
  });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}