-- Revolut-Transaktionen (Import via Python-Script)
CREATE TABLE IF NOT EXISTS revolut_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount_eur NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  original_amount NUMERIC,
  original_currency TEXT,
  type TEXT,                          -- 'CARD_PAYMENT', 'TRANSFER', 'TOPUP', etc.
  state TEXT,                         -- 'COMPLETED', 'PENDING', 'REVERTED'
  category TEXT,                      -- Claude-Kategorie
  raw_category TEXT,                  -- Original-Kategorie aus Revolut
  month TEXT GENERATED ALWAYS AS (to_char(date, 'YYYY-MM')) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revolut_transactions_date_idx ON revolut_transactions(date);
CREATE INDEX IF NOT EXISTS revolut_transactions_month_idx ON revolut_transactions(month);
CREATE INDEX IF NOT EXISTS revolut_transactions_category_idx ON revolut_transactions(category);

-- Monatliche Ausgaben-Aggregation (vorberechnet von Python)
CREATE TABLE IF NOT EXISTS expense_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,                -- '2026-05'
  category TEXT NOT NULL,
  total_eur NUMERIC NOT NULL DEFAULT 0,
  transaction_count INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, category)
);

CREATE INDEX IF NOT EXISTS expense_summaries_month_idx ON expense_summaries(month);

-- Gesundheits-Korrelations-Ergebnisse (vorberechnet von Python/scipy)
CREATE TABLE IF NOT EXISTS health_analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,                 -- 'correlations', 'trends', 'distributions'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  results JSONB NOT NULL,             -- {hrv_acwr: 0.72, hrv_sleep: 0.81, ...}
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_analysis_results_type_idx ON health_analysis_results(type);
CREATE INDEX IF NOT EXISTS health_analysis_results_period_idx ON health_analysis_results(period_start, period_end);
