-- v2 feed layer: add Workday as an ATS provider. Unlike the token-based
-- boards, a Workday company's config is a triple (tenant/wd-number/site)
-- packed into company_registry.ats_token as "tenant:wd:site" — see
-- services/scraper/feeds/providers/workday.py. Workday is what unlocks the
-- large enterprises (Nvidia/Dell/Deloitte/Adobe/…) that run their careers
-- site on it, with DIRECT apply links (not aggregator redirects).

-- 1. Allow 'workday' in the company_registry provider CHECK constraint.
ALTER TABLE company_registry DROP CONSTRAINT IF EXISTS company_registry_ats_provider_check;
ALTER TABLE company_registry ADD CONSTRAINT company_registry_ats_provider_check
    CHECK (ats_provider IN ('greenhouse','lever','ashby','workable',
                            'smartrecruiters','recruitee','workday'));

-- 2. Register the source so the admin enable/disable toggle controls it.
INSERT INTO scraper_sources (name, family) VALUES ('workday','job')
ON CONFLICT (name) DO NOTHING;
