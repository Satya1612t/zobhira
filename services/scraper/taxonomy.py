"""Curated technical (+ digital marketing) designation taxonomy. Confirmed
with the user as a 15-stream, 58-designation list.

The scheduler no longer searches each of the 58 designations individually
(58 x 5 sources = 290 queries/cycle was redundant — most streams' titles
are variations a single broad search already surfaces). Instead it searches
STREAM_QUERIES (15 broad terms, one per stream, 15 x 5 = 75 queries/cycle)
and each scraped posting's title is matched back against
TECHNICAL_DESIGNATIONS afterward (see designation_classifier.py) to tag it
with the specific designation(s) it belongs to, for browse/filter use."""

# One broad representative query per stream — deliberately generic so a
# site's own relevance search surfaces the full range of designations
# within that stream (e.g. "Software Developer" should turn up Frontend/
# Backend/Full Stack/Web postings, not just literal "Software Developer"
# titles). Order matches the stream order below and apps/web's streams.ts.
STREAM_QUERIES: list[str] = [
    "Software Developer",       # Software/Web Development
    "Mobile Developer",         # Mobile Development
    "Data Scientist",           # Data Science / ML / AI
    "Data Engineer",            # Data Engineering & Analytics
    "DevOps Engineer",          # DevOps / Cloud / SRE
    "QA Engineer",              # QA / Software Testing
    "Security Engineer",        # Cybersecurity
    "Database Administrator",   # Database Administration
    "Embedded Systems Engineer",# Embedded Systems / IoT
    "Blockchain Developer",     # Blockchain / Web3
    "Game Developer",           # Game Development
    "UX Designer",              # UI/UX
    "Engineering Manager",      # Engineering Management / Technical Lead
    "Network Engineer",         # Networking / Systems Administration
    "Digital Marketing",        # Digital Marketing
]

TECHNICAL_DESIGNATIONS: list[str] = [
    # Software/Web Development
    "Frontend Developer",
    "Backend Developer",
    "Full Stack Developer",
    "Web Developer",
    # Mobile Development
    "Android Developer",
    "iOS Developer",
    "Flutter Developer",
    "React Native Developer",
    # Data Science / ML / AI
    "Data Scientist",
    "Machine Learning Engineer",
    "AI Engineer",
    "NLP Engineer",
    "Computer Vision Engineer",
    # Data Engineering & Analytics
    "Data Engineer",
    "Data Analyst",
    "BI Developer",
    "Analytics Engineer",
    # DevOps / Cloud / SRE
    "DevOps Engineer",
    "Site Reliability Engineer",
    "Cloud Engineer",
    "Platform Engineer",
    "Infrastructure Engineer",
    # QA / Software Testing
    "QA Engineer",
    "Automation Test Engineer",
    "Manual Tester",
    "SDET",
    # Cybersecurity
    "Security Engineer",
    "Penetration Tester",
    "SOC Analyst",
    "Security Analyst",
    # Database Administration
    "Database Administrator",
    "SQL Developer",
    "Data Warehouse Engineer",
    # Embedded Systems / IoT
    "Embedded Systems Engineer",
    "IoT Engineer",
    "Firmware Engineer",
    # Blockchain / Web3
    "Blockchain Developer",
    "Smart Contract Engineer",
    "Web3 Developer",
    # Game Development
    "Game Developer",
    "Unity Developer",
    "Unreal Engine Developer",
    # UI/UX
    "UI Designer",
    "UX Designer",
    "Product Designer",
    # Engineering Management / Technical Lead
    "Engineering Manager",
    "Technical Lead",
    "Software Architect",
    # Networking / Systems Administration
    "Network Engineer",
    "Systems Administrator",
    "IT Support Engineer",
    # Digital Marketing
    "SEO Specialist",
    "SEM/PPC Specialist",
    "Social Media Marketing Manager",
    "Content Marketing Manager",
    "Performance Marketing Manager",
    "Marketing Analyst",
    "Growth Marketing Manager",
]
