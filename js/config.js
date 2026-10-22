// Configurazione pubblica dell'app. La chiave "anon" di Supabase è pensata per stare nel browser:
// i dati sono protetti dalle regole RLS del database, non dalla segretezza della chiave.
// Non inserire MAI qui la chiave "service_role".
window.SDM_CONFIG = {
  SUPABASE_URL: "https://wwaomtfchpplmmxdpsqa.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YW9tdGZjaHBwbG1teGRwc3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQ5MTIsImV4cCI6MjA5NzIwMDkxMn0.OyIYsrpg4yZQVxeG7gxA0KQRqM7q0MOc29AWaGNxhR8",
  SCHEMA: "sdm_eventi",
  OTP_MINUTI: 5           // deve coincidere con "Email OTP Expiration" in Supabase (secondi / 60)
};
