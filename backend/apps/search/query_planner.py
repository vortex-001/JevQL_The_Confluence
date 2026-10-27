import re
from typing import Dict, Any, Tuple
from django.db.models import Q
from apps.datasets.models import Department, Sentiment

DEPARTMENT_SYNONYMS = {
    'engineering': Department.ENGINEERING,
    'engineers': Department.ENGINEERING,
    'dev': Department.ENGINEERING,
    'developers': Department.ENGINEERING,
    'qa': Department.ENGINEERING,
    'product': Department.PRODUCT,
    'pm': Department.PRODUCT,
    'sales': Department.SALES,
    'sdr': Department.SALES,
    'ae': Department.SALES,
    'marketing': Department.MARKETING,
    'customer success': Department.CUSTOMER_SUCCESS,
    'cs': Department.CUSTOMER_SUCCESS,
    'support': Department.CUSTOMER_SUCCESS,
    'human resources': Department.HR,
    'hr': Department.HR,
    'people ops': Department.HR,
    'finance': Department.FINANCE,
    'accounting': Department.FINANCE,
    'operations': Department.OPERATIONS,
    'ops': Department.OPERATIONS,
}

SENTIMENT_SYNONYMS = {
    'positive': Sentiment.POSITIVE,
    'praise': Sentiment.POSITIVE,
    'praises': Sentiment.POSITIVE,
    'happy': Sentiment.POSITIVE,
    'good': Sentiment.POSITIVE,
    'excellent': Sentiment.POSITIVE,
    'negative': Sentiment.NEGATIVE,
    'complaints': Sentiment.NEGATIVE,
    'complaint': Sentiment.NEGATIVE,
    'issues': Sentiment.NEGATIVE,
    'unhappy': Sentiment.NEGATIVE,
    'critical': Sentiment.NEGATIVE,
    'burnout': Sentiment.NEGATIVE,
    'neutral': Sentiment.NEUTRAL,
}

class QueryPlanner:
    """
    Translates Natural-Language user input into safe, structured Django ORM filters
    and extracts residual semantic search terms.
    NEVER generates arbitrary executable raw SQL.
    """

    def __init__(self, raw_query: str):
        self.raw_query = raw_query.strip()
        self.cleaned_search_text = self.raw_query
        self.extracted_filters: Dict[str, Any] = {}
        self.explanations = []

    def parse(self) -> Tuple[Q, Dict[str, Any], str]:
        q_obj = Q()
        query_lower = f" {self.raw_query.lower()} "

        # 1. Extract Department
        matched_dept = None
        for syn, dept_enum in DEPARTMENT_SYNONYMS.items():
            pattern = rf'\b{re.escape(syn)}\b'
            if re.search(pattern, query_lower):
                matched_dept = dept_enum
                self.extracted_filters['department'] = dept_enum
                self.explanations.append(f"Identified Department filter: {dept_enum} (matched keyword '{syn}')")
                # Remove matched token from residual search text
                self.cleaned_search_text = re.sub(pattern, '', self.cleaned_search_text, flags=re.I).strip()
                break

        if matched_dept:
            q_obj &= Q(department=matched_dept)

        # 2. Extract Sentiment
        matched_sentiment = None
        for syn, sent_enum in SENTIMENT_SYNONYMS.items():
            pattern = rf'\b{re.escape(syn)}\b'
            if re.search(pattern, query_lower):
                matched_sentiment = sent_enum
                self.extracted_filters['sentiment'] = sent_enum
                self.explanations.append(f"Identified Sentiment filter: {sent_enum} (matched intent keyword '{syn}')")
                self.cleaned_search_text = re.sub(pattern, '', self.cleaned_search_text, flags=re.I).strip()
                break

        if matched_sentiment:
            q_obj &= Q(sentiment=matched_sentiment)

        # 3. Extract Rating
        # Match rating >= X, rating > X, rating <= X, rating < X, rating X, X star
        rating_match = re.search(r'\brating\s*(>=|<=|>|<|=)?\s*([1-5])\b', query_lower)
        if not rating_match:
            rating_match = re.search(r'\b([1-5])\s*stars?\b', query_lower)
            if rating_match:
                val = int(rating_match.group(1))
                self.extracted_filters['rating'] = val
                q_obj &= Q(rating=val)
                self.explanations.append(f"Identified Exact Rating: {val}/5")
                self.cleaned_search_text = re.sub(r'\b[1-5]\s*stars?\b', '', self.cleaned_search_text, flags=re.I).strip()
        else:
            op = rating_match.group(1) or '='
            val = int(rating_match.group(2))
            if op in ('>=', 'gte'):
                q_obj &= Q(rating__gte=val)
                self.extracted_filters['rating__gte'] = val
                self.explanations.append(f"Identified Rating constraint: >= {val}")
            elif op in ('<=', 'lte'):
                q_obj &= Q(rating__lte=val)
                self.extracted_filters['rating__lte'] = val
                self.explanations.append(f"Identified Rating constraint: <= {val}")
            elif op == '>':
                q_obj &= Q(rating__gt=val)
                self.extracted_filters['rating__gt'] = val
                self.explanations.append(f"Identified Rating constraint: > {val}")
            elif op == '<':
                q_obj &= Q(rating__lt=val)
                self.extracted_filters['rating__lt'] = val
                self.explanations.append(f"Identified Rating constraint: < {val}")
            else:
                q_obj &= Q(rating=val)
                self.extracted_filters['rating'] = val
                self.explanations.append(f"Identified Exact Rating: {val}/5")
            
            self.cleaned_search_text = re.sub(r'\brating\s*(>=|<=|>|<|=)?\s*[1-5]\b', '', self.cleaned_search_text, flags=re.I).strip()

        # Handle 'low rating' or 'high rating'
        if re.search(r'\blow\s+ratings?\b', query_lower):
            q_obj &= Q(rating__lte=2)
            self.extracted_filters['rating__lte'] = 2
            self.explanations.append("Identified Low Rating constraint (rating <= 2)")
            self.cleaned_search_text = re.sub(r'\blow\s+ratings?\b', '', self.cleaned_search_text, flags=re.I).strip()
        elif re.search(r'\bhigh\s+ratings?\b', query_lower):
            q_obj &= Q(rating__gte=4)
            self.extracted_filters['rating__gte'] = 4
            self.explanations.append("Identified High Rating constraint (rating >= 4)")
            self.cleaned_search_text = re.sub(r'\bhigh\s+ratings?\b', '', self.cleaned_search_text, flags=re.I).strip()

        # Clean filler words
        filler_words = ['find', 'show', 'all', 'records', 'about', 'with', 'from', 'the', 'give', 'me', 'list']
        for fw in filler_words:
            self.cleaned_search_text = re.sub(rf'\b{fw}\b', '', self.cleaned_search_text, flags=re.I).strip()

        # Remove extra whitespace
        self.cleaned_search_text = re.sub(r'\s+', ' ', self.cleaned_search_text).strip()

        if self.cleaned_search_text:
            self.explanations.append(f"Extracted semantic search topic: '{self.cleaned_search_text}'")
        else:
            self.explanations.append("Pure structured filter query (no residual topic keywords).")

        return q_obj, self.extracted_filters, self.cleaned_search_text
