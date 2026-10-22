// Configurazione pubblica dell'app. La chiave "anon" di Supabase è pensata per stare nel browser:
// i dati sono protetti dalle regole RLS del database, non dalla segretezza della chiave.
// Non inserire MAI qui la chiave "service_role".
window.SDM_CONFIG = {
  SUPABASE_URL: "",       // es. https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: "",  // Project Settings > API > anon public
  SCHEMA: "sdm_eventi"
};
