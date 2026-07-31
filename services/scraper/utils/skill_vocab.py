"""Skill vocabulary — loaded from the database, seeded from the dict below.

WHAT CHANGED AND WHY
--------------------
This file used to BE the vocabulary: a hand-edited dict of ~117 skills. Two
problems with that, both fatal in the medium term:

  1. It rots. New frameworks appear monthly and nobody remembers to add them.
     An audit of the original list found FIVE of the fifteen taxonomy streams
     with literally zero coverage — Embedded/IoT, Blockchain/Web3, Game Dev,
     Networking/SysAdmin, and enterprise/ERP. The last is the costliest for
     this market: SAP, Salesforce and ServiceNow are enormous Indian hiring
     categories and none of them tagged at all.
  2. It existed twice. skill_vocab.py for the writer, skillVocab.ts for the
     reader. If the two drifted the skills filter silently returned nothing —
     silently, because an empty result set looks exactly like "no such jobs".

Now the live vocabulary lives in the `skills` / `skill_aliases` tables
(migration 0020), both Python and TypeScript read from there, and
scripts/mine_skills.py grows it from scraped descriptions and from what users
actually search for. SEED_SKILL_ALIASES below is only the bootstrap — run
scripts/seed_skills.py once and it is never read again in production.

SCOPE GUARD: SKILLS ONLY. Technologies, tools, platforms, frameworks, and
specific technical practices. Not designations (designation_classifier owns
those), not employment types, not locations, not degrees, not soft skills.
The miner is aggressive; without that rule the vocabulary fills with
"Bangalore" and "B.Tech" and then every job gets tagged with them.
"""

from __future__ import annotations

import logging
import re
import threading
import time

logger = logging.getLogger(__name__)

# How long a loaded vocabulary is trusted before re-reading the tables. The
# miner runs weekly, so staleness costs nothing; the cache exists so a sweep
# of thousands of postings does not re-query per posting.
CACHE_TTL_SECONDS = 300


def normalize(tag: str) -> str:
    """The single normalization used for tags_norm, for stored aliases, and
    for user-typed filter input. Every consumer MUST call this — the symmetry
    is the entire mechanism. Mirrored in apps/web/src/lib/skillVocab.ts."""
    return re.sub(r"[\s._\-/]+", "", tag.strip().lower())


# ===========================================================================
# BOOTSTRAP SEED — read once by scripts/seed_skills.py, then never again.
# Add new skills via the miner or `mine_skills.py --promote`, not here.
# ===========================================================================
SEED_SKILL_ALIASES: dict[str, list[str]] = {
    # Languages
    "JavaScript": ["JS", "ECMAScript"], "TypeScript": ["TS"],
    "Python": ["Python3"], "Java": ["Core Java", "J2EE", "JEE"],
    "C++": ["CPP"], "C#": ["CSharp", "C Sharp"], "Embedded C": ["ANSI C"],
    "Golang": ["Go lang"], "Rust": [], "Ruby": [], "PHP": [], "Swift": [],
    "Kotlin": [], "Scala": [], "Perl": [], "R Programming": ["RStudio"],
    "MATLAB": ["Simulink"], "Objective-C": [], "Dart": [], "Groovy": [],
    "Shell Scripting": ["Bash", "PowerShell"], "VBA": ["Visual Basic"],
    "COBOL": ["Mainframe"], "Assembly": [],
    # Frontend
    "React": ["ReactJS", "React.js", "React JS"], "Angular": ["AngularJS"],
    "Vue": ["VueJS", "Vue.js"], "Next.js": ["NextJS"], "Nuxt": ["NuxtJS"],
    "Svelte": ["SvelteKit"], "Redux": ["Zustand"], "Tailwind": ["TailwindCSS"],
    "Bootstrap": [], "Material UI": ["MUI"], "HTML": ["HTML5"], "CSS": ["CSS3"],
    "Sass": ["SCSS", "LESS"], "jQuery": [], "Webpack": ["Vite", "Babel"],
    "Storybook": [], "Three.js": ["WebGL"], "Web Accessibility": ["WCAG", "a11y"],
    # Backend
    "Node.js": ["NodeJS", "Node JS", "Node"], "Express": ["ExpressJS", "NestJS"],
    "Django": ["DRF"], "Flask": [], "FastAPI": [],
    "Spring Boot": ["SpringBoot", "Spring MVC", "Spring Framework"],
    "Hibernate": ["JPA"], "Rails": ["Ruby on Rails", "RoR"],
    "Laravel": ["CodeIgniter", "Symfony"], ".NET": ["ASP.NET", ".NET Core"],
    "GraphQL": ["Apollo"], "gRPC": ["Protobuf"], "REST": ["RESTful", "REST API"],
    "Microservices": [], "RabbitMQ": ["Celery"], "WebSocket": ["Socket.io"],
    "OpenAPI": ["Swagger"], "Serverless": ["AWS Lambda", "Azure Functions"],
    "System Design": ["Distributed Systems", "HLD", "LLD"],
    "Design Patterns": ["SOLID", "OOP"],
    # Mobile
    "React Native": [], "Flutter": [], "Android": ["Android SDK"],
    "Jetpack Compose": ["Jetpack"], "iOS": ["Xcode"], "SwiftUI": [],
    "Retrofit": ["Dagger", "Hilt"], "Ionic": ["Cordova", "Xamarin"],
    "Firebase": ["Firestore"],
    # Data science / ML / AI
    "Machine Learning": ["ML", "MLOps"], "Deep Learning": ["Neural Networks", "CNN"],
    "NLP": ["Natural Language Processing"], "Computer Vision": ["OpenCV", "YOLO"],
    "Generative AI": ["GenAI", "LLM", "LLMs", "Prompt Engineering"],
    "RAG": ["Vector Database", "Pinecone", "FAISS"],
    "TensorFlow": ["Keras"], "PyTorch": [], "Pandas": [], "NumPy": ["SciPy"],
    "Scikit-learn": ["sklearn"], "XGBoost": ["LightGBM"],
    "LangChain": ["LlamaIndex", "Hugging Face"],
    "Statistics": ["A/B Testing", "Hypothesis Testing"], "Time Series": ["ARIMA"],
    "MLflow": ["Kubeflow", "SageMaker"], "Jupyter": ["Google Colab"],
    # Data engineering / BI
    "Spark": ["PySpark"], "Hadoop": ["HDFS", "MapReduce"], "Hive": [],
    "Kafka": ["Apache Kafka"], "Airflow": ["Apache Airflow"], "dbt": [],
    "Snowflake": [], "Databricks": ["Delta Lake"], "BigQuery": [],
    "Redshift": [], "Flink": [], "NiFi": [],
    "Informatica": ["Talend", "SSIS", "Datastage"],
    "ETL": ["ELT", "Data Pipeline"], "Data Warehousing": ["Star Schema", "Data Modelling"],
    "Power BI": ["PowerBI", "DAX"], "Tableau": [], "Looker": ["Qlik", "QlikView"],
    "Excel": ["MS Excel", "Advanced Excel", "VLOOKUP"],
    # Databases
    "SQL": [], "PostgreSQL": ["Postgres", "PSQL"], "MySQL": ["MariaDB"],
    "MongoDB": ["Mongo"], "Redis": ["Memcached"],
    "Elasticsearch": ["ELK", "OpenSearch", "Solr"], "Cassandra": [],
    "DynamoDB": [], "SQLite": [], "Oracle": ["PL/SQL"],
    "SQL Server": ["MSSQL", "T-SQL", "SSRS"], "Neo4j": ["Graph Database"],
    "Query Optimization": ["Indexing", "Performance Tuning"],
    "Backup and Recovery": ["Disaster Recovery", "RMAN", "High Availability"],
    # Cloud / DevOps
    "AWS": ["Amazon Web Services", "EC2", "CloudFormation"],
    "Azure": ["Microsoft Azure", "Azure DevOps"], "GCP": ["Google Cloud"],
    "Docker": ["Containerization"], "Kubernetes": ["K8s", "OpenShift"],
    "Helm": [], "Terraform": ["IaC", "Pulumi"], "Ansible": ["Puppet", "Chef"],
    "Jenkins": [], "GitHub Actions": ["GitLab CI", "CircleCI"],
    "ArgoCD": ["GitOps"], "Prometheus": ["Grafana"],
    "Datadog": ["New Relic", "Dynatrace", "AppDynamics"],
    "Nginx": ["HAProxy", "Load Balancing"], "Istio": ["Service Mesh"],
    "Vault": ["HashiCorp Vault"],
    "Git": ["GitHub", "GitLab", "Bitbucket", "SVN"],
    "Linux": ["Unix", "Ubuntu", "RHEL", "CentOS"],
    "CI/CD": ["CICD", "Continuous Integration"],
    "Observability": ["OpenTelemetry", "Monitoring"],
    # QA
    "Selenium": ["Selenium WebDriver"], "Playwright": ["Puppeteer"],
    "Cypress": [], "Appium": ["Espresso"], "TestNG": ["JUnit", "NUnit"],
    "Jest": ["Vitest"], "Pytest": ["Robot Framework"],
    "Cucumber": ["BDD", "Gherkin", "SpecFlow"],
    "JMeter": ["LoadRunner", "Gatling", "K6", "Performance Testing"],
    "Postman": ["Rest Assured", "SoapUI", "API Testing"],
    "Test Automation": ["Automation Testing"],
    "Manual Testing": ["Regression Testing", "UAT"], "Katalon": ["Tosca", "UFT"],
    "TDD": [],
    # Cybersecurity
    "Cybersecurity": ["Cyber Security", "InfoSec"],
    "Penetration Testing": ["Pentest", "Ethical Hacking", "VAPT"],
    "Burp Suite": ["OWASP ZAP"], "Wireshark": ["tcpdump"],
    "Nmap": ["Nessus", "Metasploit"], "Kali Linux": [],
    "OWASP": ["Secure Coding", "SAST", "DAST"],
    "SIEM": ["QRadar", "ArcSight"], "SOC": ["Incident Response"],
    "Firewall": ["Palo Alto", "Fortinet", "IDS", "IPS"],
    "IAM": ["Okta", "Active Directory", "SSO", "SAML", "LDAP"],
    "Cryptography": ["Encryption", "PKI", "TLS"],
    "ISO 27001": ["SOC 2", "PCI DSS", "HIPAA"],
    "Cloud Security": ["Zero Trust"], "Forensics": ["Malware Analysis"],
    "OAuth": ["OAuth2"], "JWT": [],
    # Embedded / IoT
    "RTOS": ["FreeRTOS", "VxWorks", "Zephyr"],
    "Microcontroller": ["STM32", "ESP32", "ESP8266"],
    "Arduino": ["Raspberry Pi"], "ARM": ["ARM Cortex"],
    "Verilog": ["VHDL", "SystemVerilog", "FPGA", "RTL Design"],
    "Embedded Linux": ["Yocto", "Device Driver", "Kernel Programming"],
    "I2C": ["SPI", "UART", "CAN Bus", "Modbus"],
    "MQTT": ["Zigbee", "LoRaWAN", "BLE"],
    "PCB Design": ["Altium", "KiCad"], "Firmware": ["Bootloader"],
    "Signal Processing": ["DSP"], "AUTOSAR": ["ISO 26262", "MISRA"],
    # Blockchain
    "Solidity": ["Smart Contract", "Smart Contracts"],
    "Ethereum": ["EVM", "ERC20"], "Web3.js": ["Ethers.js", "Web3"],
    "Hardhat": ["Truffle", "Foundry"], "Solana": [],
    "Hyperledger": ["Corda"], "IPFS": [], "DeFi": ["NFT", "DAO"],
    "Blockchain": ["Distributed Ledger"], "MetaMask": ["WalletConnect"],
    # Game dev
    "Unity": ["Unity3D"], "Unreal Engine": ["Unreal", "UE5", "Blueprints"],
    "Godot": [], "Blender": ["Maya", "3ds Max", "3D Modelling"],
    "Shader": ["HLSL", "GLSL"], "Cocos2d": ["Phaser", "LibGDX"],
    "AR/VR": ["Augmented Reality", "Virtual Reality", "ARCore", "ARKit", "XR"],
    # UI/UX
    "Figma": ["FigJam"], "Adobe XD": [], "Sketch": ["InVision", "Framer"],
    "Photoshop": ["Illustrator", "After Effects"], "Canva": [],
    "Wireframing": ["Wireframes"], "Prototyping": [],
    "User Research": ["UX Research", "Usability Testing"],
    "Design System": ["Component Library", "Atomic Design"],
    "Information Architecture": ["User Flow", "Journey Mapping"], "Miro": ["Balsamiq"],
    # Networking / sysadmin
    "TCP/IP": ["OSI Model", "Subnetting"], "Cisco": ["CCNA", "CCNP"],
    "DNS": ["DHCP", "NAT", "VLAN"], "VPN": ["IPSec", "SD-WAN"],
    "VMware": ["vSphere", "ESXi", "Hyper-V", "Virtualization"],
    "Windows Server": ["Group Policy", "IIS"],
    "Network Monitoring": ["Nagios", "Zabbix", "SolarWinds"],
    "ITIL": ["Service Desk", "Ticketing"],
    "System Administration": ["Desktop Support", "L1 Support", "L2 Support"],
    # Enterprise / ERP / CRM
    "SAP": ["SAP ERP", "SAP S/4HANA"], "SAP ABAP": ["ABAP"],
    "SAP FICO": ["SAP MM", "SAP SD", "SAP HCM", "SAP BASIS", "SuccessFactors"],
    "Salesforce": ["SFDC", "Apex", "LWC"], "ServiceNow": [],
    "Oracle ERP": ["Oracle Fusion", "Oracle EBS", "PeopleSoft"],
    "Workday": [], "Microsoft Dynamics": ["Dynamics 365", "D365"],
    "Power Apps": ["Power Automate", "Power Platform"],
    "SharePoint": ["Office 365"], "Zoho": ["Zoho CRM"], "Tally": ["Tally ERP"],
    # Digital marketing
    "SEO": ["Search Engine Optimization", "On-page SEO", "Link Building"],
    "SEM": ["PPC", "Pay Per Click"],
    "Google Analytics": ["GA4", "Google Tag Manager"],
    "Google Ads": ["AdWords"], "Meta Ads": ["Facebook Ads", "Instagram Ads"],
    "Semrush": ["Ahrefs", "Screaming Frog", "Keyword Research"],
    "Content Marketing": ["Copywriting", "Content Strategy"],
    "Email Marketing": ["Mailchimp", "Klaviyo", "Marketing Automation"],
    "Social Media Marketing": ["SMM", "Influencer Marketing"],
    "HubSpot": ["Marketo", "Pardot"], "WordPress": ["Webflow", "Wix"],
    "Shopify": ["WooCommerce", "Magento"],
    "Conversion Optimization": ["CRO"], "Performance Marketing": ["ROAS", "Media Buying"],
    # Ways of working
    "Agile": ["Scrum", "Kanban", "Safe Agile"],
    "Jira": ["Confluence", "Asana", "Trello"],
    "Data Structures": ["DSA", "Algorithms", "Competitive Programming"],
    "Business Analysis": ["Gap Analysis", "UML", "BRD", "FRD"],
}

# Seeded as ambiguous=true: valid vocabulary, but never matched as bare free
# text. Every one was an observed false positive.
#   JS -> fires inside "Node JS"      REST   -> "the rest of the team"
#   Spring -> "Spring 2026 internship"  Excel -> "candidates who excel at"
#   SEM -> "6th sem"                  CV     -> "attach your CV"
#   Helm -> "at the helm of"          Sketch -> "sketch out a solution"
SEED_AMBIGUOUS = {
    "JS", "TS", "CV", "DL", "REST", "Spring", "Excel", "SEM", "Node", "Helm",
    "Sketch", "ARM", "SOC", "Vault", "Hive", "Unity", "Dart", "Assembly",
    "Blender", "Canva", "Shader", "Firewall", "Forensics", "Web3", "Tally",
    "Zoho", "Sprint", "Lambda",
}

# High-value but ambiguous: counted only when a corroborating term appears in
# the same text. Buys back skills the ambiguous list would otherwise cost —
# "Swift" is a major mobile skill, but "swift resolution" is corporate filler.
SEED_CONTEXT_REQUIRED: dict[str, list[str]] = {
    "Swift": ["ios", "xcode", "swiftui", "objective-c", "mobile", "app store"],
    "Unity": ["game", "3d", "c#", "unreal", "ar", "vr"],
    "Blender": ["3d", "game", "animation", "modelling", "render"],
    "Rust": ["systems", "backend", "cargo", "wasm", "solana", "memory safety"],
    "Hive": ["hadoop", "spark", "big data", "hdfs", "warehouse"],
    "Helm": ["kubernetes", "k8s", "chart", "devops", "cluster"],
    "Vault": ["hashicorp", "secrets", "devops", "credentials"],
    "Canva": ["design", "graphic", "social media", "creative", "marketing"],
    "Tally": ["accounting", "erp", "gst", "bookkeeping"],
    "Sketch": ["design", "ux", "ui", "figma", "wireframe"],
    "Assembly": ["embedded", "firmware", "low level", "microcontroller", "x86"],
}


# ===========================================================================
# Runtime vocabulary (loaded from the database)
# ===========================================================================

class _Vocabulary:
    """Immutable snapshot. Rebuilt wholesale rather than mutated, so a sweep
    in progress never sees a half-updated matcher list."""

    __slots__ = ("alias_to_canonical", "canonicals", "matchers", "context_required", "loaded_at")

    def __init__(self, rows_skills, rows_aliases) -> None:
        self.alias_to_canonical: dict[str, str] = {}
        self.canonicals: list[str] = []
        self.context_required: dict[str, list[str]] = {}
        ambiguous: set[str] = set()

        for row in rows_skills:
            canonical = row["canonical"]
            self.canonicals.append(canonical)
            self.alias_to_canonical[row["normalized"]] = canonical
            if row["ambiguous"]:
                ambiguous.add(normalize(canonical))
            if row["context_required"]:
                self.context_required[canonical] = list(row["context_required"])

        surfaces: list[tuple[str, str]] = [(c, c) for c in self.canonicals]
        for row in rows_aliases:
            self.alias_to_canonical.setdefault(row["normalized"], row["canonical"])
            surfaces.append((row["canonical"], row["display"]))

        matchers: list[tuple[str, re.Pattern[str]]] = []
        for canonical, surface in surfaces:
            key = normalize(surface)
            if key in ambiguous and canonical not in self.context_required:
                continue
            matchers.append((canonical, _compile(surface)))
        # Longest surface first: "React Native" before "React", "Spring Boot"
        # before anything shorter.
        matchers.sort(key=lambda pair: len(pair[1].pattern), reverse=True)
        self.matchers = matchers
        self.loaded_at = time.time()


def _compile(term: str) -> re.Pattern[str]:
    # Boundary classes include . + # so "Node.js" matches whole and "Java"
    # does not fire inside "JavaScript" (S is a word char).
    return re.compile(rf"(?<![\w.+#]){re.escape(term)}(?![\w+#])", re.I)


_cache: _Vocabulary | None = None
_lock = threading.Lock()


def _load_from_db() -> _Vocabulary | None:
    try:
        from db.repository import connect

        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT canonical, normalized, ambiguous, context_required "
                    "FROM skills WHERE status = 'active'"
                )
                skills = cur.fetchall()
                cur.execute("SELECT normalized, display, canonical FROM skill_aliases")
                aliases = cur.fetchall()
        finally:
            conn.close()
        if not skills:
            return None
        return _Vocabulary(skills, aliases)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not load skill vocabulary from DB, using seed: %s", exc)
        return None


def _seed_vocabulary() -> _Vocabulary:
    """In-memory fallback built from SEED_SKILL_ALIASES. Used when the tables
    are empty or unreachable — so tests, the eval harness and a cold start all
    work without a database."""
    skills = [
        {
            "canonical": c,
            "normalized": normalize(c),
            "ambiguous": c in SEED_AMBIGUOUS,
            "context_required": SEED_CONTEXT_REQUIRED.get(c, []),
        }
        for c in SEED_SKILL_ALIASES
    ]
    aliases = [
        {"normalized": normalize(a), "display": a, "canonical": c}
        for c, alist in SEED_SKILL_ALIASES.items()
        for a in alist
        if normalize(a) not in {normalize(x) for x in SEED_AMBIGUOUS}
        or a in SEED_CONTEXT_REQUIRED
    ]
    return _Vocabulary(skills, aliases)


def get_vocabulary(force_reload: bool = False) -> _Vocabulary:
    global _cache
    with _lock:
        fresh = _cache is not None and (time.time() - _cache.loaded_at) < CACHE_TTL_SECONDS
        if _cache is None or force_reload or not fresh:
            _cache = _load_from_db() or _seed_vocabulary()
        return _cache


def canonicalize(tag: str) -> str | None:
    """Maps any known spelling to its canonical form; None for anything
    outside the vocabulary."""
    return get_vocabulary().alias_to_canonical.get(normalize(tag))


def canonical_skills() -> list[str]:
    """The closed list handed to the LLM in utils/ai_extract.py."""
    return sorted(get_vocabulary().canonicals)
