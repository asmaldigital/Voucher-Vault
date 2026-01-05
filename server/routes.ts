import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";
import { createUserSchema } from "../shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get('/api/config', (_req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    });
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });

      const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !requestingUser) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { data: requestingProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', requestingUser.id)
        .single();

      if (profileError || !requestingProfile || requestingProfile.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create users' });
      }

      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { email, password, role } = parseResult.data;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role }
      });

      if (createError) {
        return res.status(400).json({ error: createError.message });
      }

      return res.status(201).json({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role
        }
      });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
      });

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { data: requestingProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !requestingProfile || requestingProfile.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view users' });
      }

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        return res.status(500).json({ error: profilesError.message });
      }

      return res.json(profiles || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return httpServer;
}
