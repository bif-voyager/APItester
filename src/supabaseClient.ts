import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase URL and Anon Key
const supabaseUrl = 'https://cywtdvthyszbxyzyszzc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5d3RkdnRoeXN6Ynh5enlzenpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTYyNjMsImV4cCI6MjA4Njc5MjI2M30.vZ-zO0SxOGFeZQrv6OPylqmAK6nVZr2G3_7PTmC8r7E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
