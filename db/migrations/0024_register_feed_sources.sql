INSERT INTO scraper_sources (name, family) VALUES
    ('greenhouse','job'), ('lever','job'), ('ashby','job'),
    ('smartrecruiters','job'), ('workable','job'), ('recruitee','job')
ON CONFLICT (name) DO NOTHING;
