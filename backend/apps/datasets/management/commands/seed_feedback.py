import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.datasets.models import EmployeeFeedback, DatasetMetadata, Department, Sentiment

SYNTHETIC_RECORDS = [
    # Engineering
    {
        "dept": Department.ENGINEERING,
        "role": "Senior Backend Engineer",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Our CI/CD pipeline takes over 45 minutes on average, causing massive deployment bottlenecks and friction between dev and QA.",
        "tags": ["tooling", "ci-cd", "deployment", "infrastructure"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "Full Stack Developer",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "The migration to Kubernetes and modern service architecture has dramatically increased our team velocity and reduced pager alerts.",
        "tags": ["tooling", "infrastructure", "kubernetes", "velocity"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "Staff Data Engineer",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Data pipelines are stable, but documentation on our internal Kafka schemas is sparse and slows down onboarding for new hires.",
        "tags": ["documentation", "onboarding", "data-pipelines"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "Junior Frontend Engineer",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "My mentor has been incredible. Weekly pairing sessions helped me ramp up on our React design system quickly.",
        "tags": ["mentorship", "onboarding", "culture"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "DevOps Engineer",
        "rating": 1,
        "sentiment": Sentiment.NEGATIVE,
        "text": "On-call rotation is unsustainable. Being woken up three nights in a row due to unmonitored flaky alerts is leading directly to burnout.",
        "tags": ["burnout", "on-call", "work-life-balance", "health"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "Security Engineer",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Leadership took our audit recommendations seriously and approved budget for automated vulnerability scanning tools.",
        "tags": ["leadership", "security", "budget", "tooling"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "QA Automation Lead",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Engineering teams merge PRs without updating integration test suites, breaking staging environments almost every Tuesday.",
        "tags": ["quality", "testing", "processes"],
    },
    {
        "dept": Department.ENGINEERING,
        "role": "Platform Engineer",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Excellent team autonomy. We are empowered to select the best tools for the job and iterate quickly without bureaucratic delays.",
        "tags": ["autonomy", "culture", "leadership"],
    },

    # Product
    {
        "dept": Department.PRODUCT,
        "role": "Principal Product Manager",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Strong cross-functional collaboration with engineering and design on the Q3 roadmap planning cycle.",
        "tags": ["roadmap", "collaboration", "planning"],
    },
    {
        "dept": Department.PRODUCT,
        "role": "Associate Product Manager",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Priorities change every other sprint based on executive whims rather than actual customer metrics and feedback data.",
        "tags": ["strategy", "executive", "communication"],
    },
    {
        "dept": Department.PRODUCT,
        "role": "Product Designer",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "The new design tokens and user research repository have cut our prototype turnaround time in half.",
        "tags": ["design", "tooling", "user-research"],
    },
    {
        "dept": Department.PRODUCT,
        "role": "Technical Program Manager",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Jira workflows are overly complex with too many mandatory fields that provide little actual reporting value.",
        "tags": ["tooling", "processes", "jira"],
    },
    {
        "dept": Department.PRODUCT,
        "role": "UX Researcher",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Customers are very engaged during our usability testing interviews, and product managers actively participate in sessions.",
        "tags": ["user-research", "culture", "collaboration"],
    },

    # Sales
    {
        "dept": Department.SALES,
        "role": "Enterprise Account Executive",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Our new pricing tiers and sales enablement decks made closing Fortune 500 deals significantly easier this quarter.",
        "tags": ["pricing", "enablement", "revenue"],
    },
    {
        "dept": Department.SALES,
        "role": "Sales Development Representative",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Outdated CRM data and lack of automated lead enrichment means SDRs spend 40% of their day manually copying contact info.",
        "tags": ["tooling", "crm", "efficiency", "sales"],
    },
    {
        "dept": Department.SALES,
        "role": "Solutions Architect",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Product team provided rapid technical responses during client RFP evaluations, directly helping us secure the contract.",
        "tags": ["collaboration", "cross-team", "sales-engineering"],
    },
    {
        "dept": Department.SALES,
        "role": "Sales Manager",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Commission structures were adjusted fairly, but quarterly quota calculations were communicated three weeks late.",
        "tags": ["compensation", "communication", "quota"],
    },
    {
        "dept": Department.SALES,
        "role": "Account Manager",
        "rating": 1,
        "sentiment": Sentiment.NEGATIVE,
        "text": "High churn rate among mid-market accounts due to unresolved product bugs is wiping out account renewals.",
        "tags": ["churn", "product-bugs", "customer-retention"],
    },

    # Customer Success
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Customer Success Manager",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Weekly sync with product managers to review top customer tickets has established great mutual accountability.",
        "tags": ["customer-focus", "collaboration", "accountability"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Support Engineer",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Support ticket volume increased by 60% after the v2 release, but support staffing levels remained completely flat.",
        "tags": ["workload", "burnout", "staffing", "support"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Implementation Specialist",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Client onboarding workflows are now well-standardized, cutting customer time-to-value down to 14 days.",
        "tags": ["onboarding", "efficiency", "customer-satisfaction"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Customer Success Director",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Customer satisfaction score (CSAT) is steady at 91%, but we need more proactive churn prediction alerts.",
        "tags": ["csat", "analytics", "churn"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Customer Support Lead",
        "rating": 1,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Disappointing purchase with poor quality materials. Terrible experience overall and definitely not worth the money.",
        "tags": ["product-review", "quality", "disappointment"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Returns & Warranty Specialist",
        "rating": 1,
        "sentiment": Sentiment.NEGATIVE,
        "text": "The device was completely defective out of the box, so I sent it back after 48 hours to request an immediate refund.",
        "tags": ["return", "defect", "refund"],
    },
    {
        "dept": Department.OPERATIONS,
        "role": "Fulfillment Coordinator",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Customers reported delayed shipping and late arrival of their shipments due to regional courier transit bottlenecks.",
        "tags": ["delivery", "shipping", "transit-delay"],
    },
    {
        "dept": Department.CUSTOMER_SUCCESS,
        "role": "Support Tier 2 Specialist",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "A client expressed frustration regarding UI lag in reports, but chose to keep the annual software license.",
        "tags": ["ui-performance", "software", "retention"],
    },

    # Marketing
    {
        "dept": Department.MARKETING,
        "role": "Content Strategist",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Our thought leadership blog posts and organic SEO strategy produced a 120% surge in qualified inbound leads.",
        "tags": ["inbound", "seo", "content", "leads"],
    },
    {
        "dept": Department.MARKETING,
        "role": "Performance Marketing Manager",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Ad budget cuts without adjusting quarterly customer acquisition targets puts unreasonable pressure on paid search campaigns.",
        "tags": ["budget", "kpis", "advertising"],
    },
    {
        "dept": Department.MARKETING,
        "role": "Product Marketing Lead",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "The annual user conference was a massive success, with high executive visibility and positive attendee sentiment.",
        "tags": ["events", "branding", "executive"],
    },
    {
        "dept": Department.MARKETING,
        "role": "Graphic Designer",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Brand guidelines are clean, but ad-hoc asset requests from regional sales reps disrupt planned sprint deliverables.",
        "tags": ["processes", "branding", "communication"],
    },

    # Human Resources
    {
        "dept": Department.HR,
        "role": "People Operations Specialist",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "The rollout of the new global wellness stipend and mental health coaching benefit received overwhelming employee praise.",
        "tags": ["benefits", "wellness", "mental-health", "culture"],
    },
    {
        "dept": Department.HR,
        "role": "Technical Recruiter",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Hiring engineering talent remains competitive; our compensation bands in Tier-1 cities need regular market adjustments.",
        "tags": ["recruiting", "compensation", "hiring"],
    },
    {
        "dept": Department.HR,
        "role": "HR Business Partner",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Manager training on resolving peer conflicts and conducting effective 1-on-1s is lacking across middle management.",
        "tags": ["management", "training", "leadership", "culture"],
    },
    {
        "dept": Department.HR,
        "role": "Diversity & Inclusion Lead",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Employee Resource Groups (ERGs) have grown significantly and leadership has committed dedicated budget for guest speakers.",
        "tags": ["diversity", "inclusion", "culture", "leadership"],
    },

    # Finance & Operations
    {
        "dept": Department.FINANCE,
        "role": "Financial Analyst",
        "rating": 4,
        "sentiment": Sentiment.POSITIVE,
        "text": "Automated expense reporting system has reduced reimbursement cycle time from two weeks to 48 hours.",
        "tags": ["finance", "tooling", "automation"],
    },
    {
        "dept": Department.FINANCE,
        "role": "Senior Accountant",
        "rating": 2,
        "sentiment": Sentiment.NEGATIVE,
        "text": "Month-end close is still heavily reliant on manual Excel reconciliation due to delayed ERP integrations.",
        "tags": ["finance", "manual-work", "tooling"],
    },
    {
        "dept": Department.OPERATIONS,
        "role": "IT Workplace Specialist",
        "rating": 5,
        "sentiment": Sentiment.POSITIVE,
        "text": "Hardware provisioning for remote employees now happens seamlessly with pre-configured laptop drop-shipping.",
        "tags": ["remote-work", "it", "hardware", "onboarding"],
    },
    {
        "dept": Department.OPERATIONS,
        "role": "Office Facilities Manager",
        "rating": 3,
        "sentiment": Sentiment.NEUTRAL,
        "text": "Hybrid workplace desk booking software works reasonably well, but acoustic privacy pods on floor 3 are always booked.",
        "tags": ["workplace", "hybrid", "facilities"],
    },
]

EXPANSION_TEMPLATES = [
    ("Engineering", "Software Engineer", 1, "Negative", "Deployment failures occur during peak hours due to lack of canary testing. We desperately need better rollback tooling.", ["deployments", "tooling", "reliability"]),
    ("Engineering", "Cloud Architect", 5, "Positive", "Our multi-region cloud migration reduced customer latency by 35% and improved uptime SLAs.", ["cloud", "performance", "architecture"]),
    ("Engineering", "Frontend Engineer", 3, "Neutral", "Refactoring legacy components to modern TypeScript is progressing, though test coverage remains around 50%.", ["typescript", "code-quality", "legacy"]),
    ("Engineering", "Site Reliability Engineer", 2, "Negative", "Alert fatigue is real. We receive dozens of low-priority Slack alerts every hour that distract from proactive maintenance.", ["alerts", "sre", "burnout"]),
    ("Engineering", "Mobile Developer", 4, "Positive", "Fastlane integration and automated iOS/Android build pipelines have streamlined app store releases.", ["mobile", "automation", "tooling"]),
    ("Product", "Growth PM", 5, "Positive", "A/B testing on our onboarding funnel increased free-to-paid conversion by 18% in the last 60 days.", ["growth", "ab-testing", "conversion"]),
    ("Product", "Product Operations", 2, "Negative", "Customer interview transcripts are scattered across Google Drive, Notion, and Slack with no centralized tagging.", ["knowledge-base", "processes", "documentation"]),
    ("Product", "UX Content Writer", 4, "Positive", "Design system microcopy guidelines have ensured consistent tone and terminology across all core web workflows.", ["design-system", "content", "consistency"]),
    ("Sales", "Commercial AE", 3, "Neutral", "Deal sizes are growing, but legal contract review cycles take upwards of three weeks per enterprise prospect.", ["legal", "sales-cycle", "processes"]),
    ("Sales", "Inbound SDR", 4, "Positive", "Marketing webinars have been generating high-intent leads that convert into discovery calls at double our baseline rate.", ["leads", "marketing", "collaboration"]),
    ("Sales", "Sales Enablement Trainer", 2, "Negative", "New sales hires are missing their ramp targets due to lack of role-play practice before customer calls.", ["training", "ramping", "enablement"]),
    ("Customer Success", "Technical Account Manager", 5, "Positive", "Proactive health score monitoring caught three enterprise renewal risks before the accounts entered the churn danger zone.", ["retention", "health-score", "customer-success"]),
    ("Customer Success", "Escalations Specialist", 2, "Negative", "Engineering does not have an SLA for tier-3 bug fixes requested by key enterprise accounts.", ["sla", "bug-fixes", "engineering-cs"]),
    ("Marketing", "Digital Marketing Specialist", 4, "Positive", "LinkedIn ad campaigns targeting VP of Engineering personas showed our lowest cost per acquisition all year.", ["advertising", "cpa", "leads"]),
    ("Marketing", "Brand Specialist", 3, "Neutral", "Social media engagement is steady, but we need more video content and customer case studies.", ["social-media", "content", "case-studies"]),
    ("Human Resources", "Learning & Development Manager", 5, "Positive", "The annual learning stipend was increased to $1,500 per employee, resulting in high uptake of professional certifications.", ["learning", "stipend", "career-growth"]),
    ("Human Resources", "Compensation Analyst", 3, "Neutral", "Market salary benchmarking was completed on schedule, but communicating the changes to employees will be challenging.", ["compensation", "benchmarking", "communication"]),
    ("Human Resources", "Culture Coordinator", 4, "Positive", "Quarterly hackathon produced several tangible product improvements and boosted morale across remote teams.", ["hackathon", "morale", "remote-work"]),
    ("Operations", "Legal Counsel", 2, "Negative", "Vendors frequently submit non-standard DPAs and contracts that require hours of redlining without automated review tools.", ["legal", "compliance", "tooling"]),
    ("Finance", "Procurement Specialist", 4, "Positive", "Consolidating software SaaS subscriptions across departments saved the company over $180,000 annually.", ["cost-savings", "saas", "finance"]),
]

class Command(BaseCommand):
    help = "Seeds database with 100+ realistic synthetic employee feedback records."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Wipes existing feedback records before seeding.'
        )
        parser.add_argument(
            '--count',
            type=int,
            default=120,
            help='Total number of synthetic records to seed (default: 120).'
        )

    def handle(self, *args, **options):
        clear_existing = options['clear']
        target_count = options['count']

        self.stdout.write(self.style.NOTICE("Initializing synthetic employee feedback dataset..."))

        with transaction.atomic():
            metadata, created = DatasetMetadata.objects.get_or_create(
                slug='employee-feedback',
                defaults={
                    'name': 'Employee Feedback & Survey Dataset',
                    'description': 'Quarterly synthetic employee feedback across Engineering, Product, Sales, Marketing, CS, HR, Finance, and Operations.',
                    'is_active': True,
                }
            )

            if clear_existing:
                deleted_count, _ = EmployeeFeedback.objects.filter(dataset=metadata).delete()
                self.stdout.write(self.style.WARNING(f"Cleared {deleted_count} existing records."))

            # Base pool of entries
            pool = list(SYNTHETIC_RECORDS)
            
            # Add expanded templates
            for item in EXPANSION_TEMPLATES:
                pool.append({
                    "dept": item[0],
                    "role": item[1],
                    "rating": item[2],
                    "sentiment": item[3],
                    "text": item[4],
                    "tags": item[5],
                })

            today = date.today()
            created_instances = []

            # Generate target_count records with varied dates and realistic variance
            for i in range(1, target_count + 1):
                template = pool[(i - 1) % len(pool)]
                
                # Randomize date within the last 180 days
                days_ago = random.randint(1, 180)
                submission_date = today - timedelta(days=days_ago)

                # Anonymized ID
                anonymized_id = f"EMP-{1000 + i}"

                # Text variance to ensure uniqueness and realistic dataset
                feedback_text = template["text"]
                if i > len(pool):
                    prefix_variants = [
                        "Follow-up survey note: ",
                        "Quarterly review comment: ",
                        "Anonymous submission: ",
                        "Team pulse check: ",
                        "Pulse survey response: ",
                    ]
                    feedback_text = f"{random.choice(prefix_variants)}{feedback_text}"

                SYNTHETIC_NAMES = [
                    "Riya Sharma", "Arjun Mehta", "Neha Singh", "Karan Patel", "Ananya Rao",
                    "Rohan Verma", "Pooja Nair", "Vikram Malhotra", "Sneha Iyer", "Kabir Das",
                    "Tanvi Joshi", "Aditya Kulkarni", "Meera Sen", "Siddharth Roy", "Deepika Kapoor",
                    "Harsh Vardhan", "Divya Menon", "Aarav Gupta", "Ishita Saxena", "Naveen Chawla"
                ]
                employee_name = SYNTHETIC_NAMES[(i - 1) % len(SYNTHETIC_NAMES)]

                # Determine workload mentions
                text_lower = feedback_text.lower()
                if any(w in text_lower for w in ['burnout', 'on-call', 'overwhelmed', 'bottleneck', 'workload', 'tight deadline', 'pressure']):
                    workload_level = 'High'
                elif template["rating"] >= 4:
                    workload_level = 'Low'
                else:
                    workload_level = 'Medium'

                record = EmployeeFeedback(
                    dataset=metadata,
                    anonymized_id=anonymized_id,
                    employee_name=employee_name,
                    department=template["dept"],
                    role=template["role"],
                    rating=template["rating"],
                    sentiment=template["sentiment"],
                    feedback_text=feedback_text,
                    tags=template["tags"],
                    workload_level=workload_level,
                    submission_date=submission_date,
                )
                created_instances.append(record)

            EmployeeFeedback.objects.bulk_create(created_instances)
            total = EmployeeFeedback.objects.filter(dataset=metadata).count()
            metadata.total_records = total
            metadata.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(created_instances)} synthetic records! Total in dataset: {total}"
            )
        )
