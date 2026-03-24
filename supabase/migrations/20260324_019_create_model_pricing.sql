-- Description: Create model_pricing table and seed with V1 pricing data
-- Date: 2026-03-24
-- Dependencies: none

CREATE TABLE IF NOT EXISTS model_pricing (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            TEXT NOT NULL,
    model               TEXT NOT NULL,
    input_cost_per_1k   DECIMAL(10, 8) NOT NULL,
    output_cost_per_1k  DECIMAL(10, 8) NOT NULL,
    context_window      INT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    effective_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, model, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_model_pricing_provider ON model_pricing (provider, model);
CREATE INDEX IF NOT EXISTS idx_model_pricing_active ON model_pricing (is_active, provider);

COMMENT ON TABLE model_pricing IS 'LLM model pricing reference table. Used to calculate event costs.';
COMMENT ON COLUMN model_pricing.input_cost_per_1k IS 'Cost in USD per 1,000 input tokens';
COMMENT ON COLUMN model_pricing.output_cost_per_1k IS 'Cost in USD per 1,000 output tokens';

-- Seed: Anthropic Claude models
INSERT INTO model_pricing (provider, model, input_cost_per_1k, output_cost_per_1k, context_window) VALUES
    ('anthropic', 'claude-opus-4-6',        0.01500000, 0.07500000, 200000),
    ('anthropic', 'claude-sonnet-4-6',      0.00300000, 0.01500000, 200000),
    ('anthropic', 'claude-haiku-4-5',       0.00080000, 0.00400000, 200000),
    ('anthropic', 'claude-3-5-sonnet',      0.00300000, 0.01500000, 200000),
    ('anthropic', 'claude-3-5-haiku',       0.00080000, 0.00400000, 200000),
    ('anthropic', 'claude-3-opus',          0.01500000, 0.07500000, 200000)
ON CONFLICT (provider, model, effective_date) DO NOTHING;

-- Seed: OpenAI models
INSERT INTO model_pricing (provider, model, input_cost_per_1k, output_cost_per_1k, context_window) VALUES
    ('openai', 'gpt-4o',                    0.00250000, 0.01000000, 128000),
    ('openai', 'gpt-4o-mini',               0.00015000, 0.00060000, 128000),
    ('openai', 'gpt-4-turbo',               0.01000000, 0.03000000, 128000),
    ('openai', 'gpt-4',                     0.03000000, 0.06000000, 8192),
    ('openai', 'gpt-3.5-turbo',             0.00050000, 0.00150000, 16385)
ON CONFLICT (provider, model, effective_date) DO NOTHING;

-- Seed: Google models
INSERT INTO model_pricing (provider, model, input_cost_per_1k, output_cost_per_1k, context_window) VALUES
    ('google', 'gemini-1.5-pro',            0.00125000, 0.00500000, 1000000),
    ('google', 'gemini-1.5-flash',          0.00007500, 0.00030000, 1000000),
    ('google', 'gemini-2.0-flash',          0.00010000, 0.00040000, 1000000)
ON CONFLICT (provider, model, effective_date) DO NOTHING;
