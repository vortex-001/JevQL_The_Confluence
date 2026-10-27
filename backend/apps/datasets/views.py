import csv
import io
import re
import logging
from datetime import date, datetime

from django.db import transaction
from django.db.models import Q
from django.shortcuts import redirect
from django.contrib import messages
from django.views.generic import ListView

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import EmployeeFeedback, DatasetMetadata, Department, Sentiment
from .serializers import EmployeeFeedbackSerializer, DatasetMetadataSerializer

logger = logging.getLogger(__name__)


class DatasetListView(ListView):
    """View to browse dataset records in Django template."""
    model = EmployeeFeedback
    template_name = 'datasets/index.html'
    context_object_name = 'records'
    paginate_by = 25

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return EmployeeFeedback.objects.filter(dataset__owner=self.request.user)
        return EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True))

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        qs = self.get_queryset()
        if self.request.user.is_authenticated:
            context['metadata'] = DatasetMetadata.objects.filter(owner=self.request.user).first()
        else:
            context['metadata'] = DatasetMetadata.objects.filter(owner__isnull=True).first()
        context['total_count'] = qs.count()
        return context


# API Viewsets
class EmployeeFeedbackViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint to view feedback records scoped strictly to the authenticated user."""
    serializer_class = EmployeeFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return EmployeeFeedback.objects.filter(dataset__owner=user)
        return EmployeeFeedback.objects.none()


class DatasetMetadataViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for dataset metadata scoped strictly to the authenticated user."""
    serializer_class = DatasetMetadataSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return DatasetMetadata.objects.filter(owner=user)
        return DatasetMetadata.objects.none()


def _detect_delimiter(text):
    """
    Detects delimiter (',', ';', '\t', '|') using scoring across headers and data rows.
    """
    candidates = [',', ';', '\t', '|']
    sample = text[:15000]

    sniffer_delim = None
    try:
        sniffer = csv.Sniffer()
        dialect = sniffer.sniff(sample, delimiters=',;\t|')
        sniffer_delim = dialect.delimiter
    except Exception:
        pass

    best_delim = ','
    best_score = -1

    schema_patterns = [
        r'id|anonymized_id|record_id|emp_id|student_id|user_id|customer_id|code|ticket_id',
        r'department|dept|category|category_name|course|subject|class|division|group|team|domain',
        r'role|job|job_title|title|position|occupation|product|item|service|instructor|course_name',
        r'employee_name|name|full_name|student_name|user_name|customer_name|author|client|person',
        r'rating|score|stars|grade|eval|evaluation|satisfaction|points',
        r'sentiment|sentiment_label|mood|feeling|polarity',
        r'feedback_text|feedback|review|comment|comments|text|description|notes|content|opinion|message|response|summary',
        r'tags|tag|keywords|labels|categories|topics',
        r'workload_level|workload|load|difficulty|intensity|status',
        r'submission_date|date|created_at|timestamp|submitted_at|time'
    ]

    for delim in candidates:
        score = 0
        try:
            reader = csv.reader(io.StringIO(sample), delimiter=delim)
            rows = []
            for _ in range(8):
                try:
                    row = next(reader)
                    if row and any(c.strip() for c in row):
                        rows.append(row)
                except StopIteration:
                    break

            if not rows or len(rows[0]) < 2:
                continue

            header_len = len(rows[0])
            score += header_len * 2

            # Check header recognition
            recognized = 0
            for col in rows[0]:
                c_clean = str(col).lower().strip().replace(' ', '_').replace('-', '_')
                for pat in schema_patterns:
                    if re.fullmatch(pat, c_clean) or c_clean == pat or pat in c_clean:
                        recognized += 1
                        break
            score += recognized * 8

            # Consistency across subsequent data rows
            consistent_rows = sum(1 for r in rows[1:] if len(r) == header_len)
            score += consistent_rows * 4

            if delim == sniffer_delim:
                score += 3

            if score > best_score:
                best_score = score
                best_delim = delim
        except Exception:
            continue

    if best_score < 0:
        return sniffer_delim or ','
    return best_delim


def _parse_and_import_csv(csv_file, metadata):
    """
    Robust CSV parser supporting:
    - Multiple encodings (utf-8-sig, utf-8, latin-1, cp1252)
    - Auto-detection of delimiters (comma, semicolon, tab, pipe)
    - First-row headers mapping to columns
    - Multiple dataset schemas (education, customer reviews, employee feedback, etc.)
    - Empty cell & missing header handling
    - Windows and Unix line endings, multiline quoted fields
    - Atomic database transactions
    """
    # 1. Read bytes and enforce size limit (15MB)
    max_size = 15 * 1024 * 1024
    content_bytes = csv_file.read()
    if len(content_bytes) > max_size:
        raise ValueError("File exceeds maximum allowed size of 15MB.")
    if len(content_bytes) == 0:
        raise ValueError("The uploaded CSV file is empty.")

    # 2. Multi-encoding decode (utf-8-sig automatically strips UTF-8 BOM)
    decoded_file = None
    for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
        try:
            decoded_file = content_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if decoded_file is None:
        decoded_file = content_bytes.decode('utf-8', errors='replace')

    # Remove null bytes if any
    decoded_file = decoded_file.replace('\x00', '')
    if not decoded_file.strip():
        raise ValueError("The uploaded CSV file contains no readable data rows.")

    # 3. Delimiter Detection
    delimiter = _detect_delimiter(decoded_file)

    # 4. Parse CSV headers
    reader = csv.DictReader(io.StringIO(decoded_file), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError("The uploaded CSV file does not contain valid column headers.")

    fieldnames = [str(f).strip().lstrip('\ufeff') for f in reader.fieldnames if f is not None]
    if not fieldnames or len(fieldnames) < 2:
        raise ValueError("The uploaded CSV file is malformed or uses an unsupported delimiter. Multiple columns could not be detected.")

    # Find column mappings flexibly using regex / keyword matching
    def find_col(patterns):
        for pattern in patterns:
            for col in fieldnames:
                c_clean = col.lower().strip().replace(' ', '_').replace('-', '_')
                if re.fullmatch(pattern, c_clean) or c_clean == pattern or (len(pattern) >= 4 and pattern in c_clean):
                    return col
        return None

    col_id = find_col(['review_id', 'id', 'anonymized_id', 'record_id', 'emp_id', 'student_id', 'user_id', 'customer_id', 'code', 'ticket_id'])
    col_dept = find_col(['course_id', 'department', 'dept', 'category', 'category_name', 'course', 'subject', 'class', 'division', 'group', 'team', 'domain'])
    col_role = find_col(['role', 'job', 'job_title', 'title', 'position', 'occupation', 'product', 'item', 'service', 'instructor', 'course_name'])
    col_name = find_col(['employee_name', 'name', 'full_name', 'student_id', 'student_name', 'user_name', 'customer_name', 'author', 'client', 'person'])
    col_rating = find_col(['teacher_rating', 'rating', 'score', 'stars', 'grade', 'eval', 'evaluation', 'satisfaction', 'points'])
    col_sentiment = find_col(['sentiment', 'sentiment_label', 'mood', 'feeling', 'polarity'])
    col_text = find_col(['review_text', 'feedback_text', 'feedback', 'review', 'comment', 'comments', 'text', 'description', 'notes', 'content', 'opinion', 'message', 'response', 'summary'])
    col_tags = find_col(['tags', 'tag', 'keywords', 'labels', 'categories', 'topics'])
    col_workload = find_col(['difficulty_rating', 'workload_level', 'workload', 'load', 'difficulty', 'intensity', 'status'])
    col_date = find_col(['review_date', 'submission_date', 'date', 'created_at', 'timestamp', 'submitted_at', 'time'])

    matched_cols = [c for c in [col_id, col_dept, col_role, col_name, col_rating, col_sentiment, col_text, col_tags, col_workload, col_date] if c is not None]
    if not matched_cols:
        raise ValueError("The uploaded CSV headers do not match any supported schema columns (e.g. employee_name, department, role, rating, feedback_text, tags).")

    created_records = []
    expected_field_count = len(reader.fieldnames)

    for idx, row in enumerate(reader, start=1):
        extra_vals = []
        if None in row and row[None]:
            extra_vals = [str(x).strip() for x in row[None] if x is not None and str(x).strip()]

        clean_row = {
            str(k).strip().lstrip('\ufeff'): (str(v).strip() if v is not None else '')
            for k, v in row.items() if k is not None
        }
        if not any(clean_row.values()):
            continue  # skip completely blank line

        # ID
        anon_id = clean_row.get(col_id) if col_id else ''
        if not anon_id:
            anon_id = f"REC-{1000 + idx}"

        # Department / Category
        dept_val = clean_row.get(col_dept) if col_dept else ''
        if not dept_val:
            dept_val = 'General'

        # Role / Item
        role_val = clean_row.get(col_role) if col_role else ''
        if not role_val:
            role_val = 'General'

        # Employee / Author Name
        name_val = clean_row.get(col_name) if col_name else ''
        if not name_val:
            name_val = f"User {anon_id}"

        # Rating (scale between 1 and 5)
        rating_raw = clean_row.get(col_rating) if col_rating else ''
        rating = 3
        if rating_raw:
            try:
                num = float(re.sub(r'[^\d\.]', '', rating_raw))
                if num > 5 and num <= 10:
                    rating = max(1, min(5, round(num / 2)))
                elif num > 10 and num <= 100:
                    rating = max(1, min(5, round(num / 20)))
                else:
                    rating = max(1, min(5, round(num)))
            except (ValueError, TypeError):
                rating = 3

        # Sentiment
        sent_val = clean_row.get(col_sentiment, '').strip().capitalize() if col_sentiment else ''
        if sent_val not in [Sentiment.POSITIVE, Sentiment.NEUTRAL, Sentiment.NEGATIVE]:
            if rating >= 4:
                sent_val = Sentiment.POSITIVE
            elif rating <= 2:
                sent_val = Sentiment.NEGATIVE
            else:
                sent_val = Sentiment.NEUTRAL

        # Feedback / Comments / Text
        text_val = clean_row.get(col_text) if col_text else ''
        if not text_val:
            other_vals = [f"{k}: {v}" for k, v in clean_row.items() if v and k not in [col_id, col_name, col_rating, col_date]]
            text_val = " | ".join(other_vals) if other_vals else "No text comments provided."

        # Tags
        tags_raw = clean_row.get(col_tags) if col_tags else ''
        if tags_raw:
            tags = [t.strip().strip('#') for t in re.split(r'[,;|]', tags_raw) if t.strip()]
        else:
            tags = []
            if dept_val and dept_val != 'General':
                tags.append(dept_val.lower().replace(' ', '-'))

        if extra_vals:
            tags.extend(extra_vals)

        # Workload / Intensity
        workload_raw = clean_row.get(col_workload, '').strip().capitalize() if col_workload else ''
        if workload_raw in ['High', 'Medium', 'Low']:
            workload = workload_raw
        elif any(w in text_val.lower() for w in ['burnout', 'on-call', 'overwhelmed', 'bottleneck', 'heavy', 'friction', 'hard']):
            workload = 'High'
        elif rating >= 4:
            workload = 'Low'
        else:
            workload = 'Medium'

        # Date
        sub_date = date.today()
        date_raw = clean_row.get(col_date) if col_date else ''
        if date_raw:
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%b %d, %Y', '%B %d, %Y']:
                try:
                    sub_date = datetime.strptime(date_raw[:10], fmt).date()
                    break
                except (ValueError, TypeError):
                    continue

        record = EmployeeFeedback(
            dataset=metadata,
            anonymized_id=anon_id[:32],
            employee_name=name_val[:100],
            department=dept_val[:50],
            role=role_val[:100],
            rating=rating,
            sentiment=sent_val,
            workload_level=workload,
            feedback_text=text_val,
            tags=tags,
            submission_date=sub_date,
        )
        created_records.append(record)

    if not created_records:
        raise ValueError("The uploaded CSV file contains no valid data rows to import.")

    # Atomic transaction ensures no partial records on error
    with transaction.atomic():
        EmployeeFeedback.objects.bulk_create(created_records)
        metadata.total_records = EmployeeFeedback.objects.filter(dataset=metadata).count()
        metadata.save()

    created_count = len(created_records)

    # Pre-index embeddings for newly uploaded records if Gemini provider is available
    if created_count > 0:
        try:
            from apps.semantic import get_semantic_provider
            provider = get_semantic_provider()
            if provider.is_available():
                new_records = list(EmployeeFeedback.objects.filter(dataset=metadata).order_by('-id')[:min(created_count, 30)])
                provider.index_records(new_records)
        except Exception as ex:
            logger.warning("Could not pre-index newly uploaded dataset: %s", ex)

    return created_count


def upload_dataset_csv_view(request):
    """Handle CSV dataset file upload in template view."""
    if request.method == 'POST' and request.FILES.get('file'):
        csv_file = request.FILES['file']
        if not csv_file.name.lower().endswith('.csv'):
            messages.error(request, "Uploaded file must be a .csv file.")
            return redirect('datasets:dataset_list')

        try:
            if request.user.is_authenticated:
                user = request.user
                metadata, _ = DatasetMetadata.objects.get_or_create(
                    owner=user,
                    defaults={
                        'name': f"{user.username}'s Feedback Dataset",
                        'slug': f"user-{user.id}-feedback",
                        'description': f"Uploaded feedback dataset for {user.username}"
                    }
                )
            else:
                metadata, _ = DatasetMetadata.objects.get_or_create(
                    owner=None,
                    slug='employee-feedback',
                    defaults={
                        'name': 'Employee Feedback Records',
                        'description': 'Uploaded feedback dataset'
                    }
                )
            created_count = _parse_and_import_csv(csv_file, metadata)
            messages.success(request, f"Successfully uploaded '{csv_file.name}'! Imported {created_count} records.")
            return redirect('home')

        except Exception as e:
            messages.error(request, f"Error processing CSV file: {str(e)}")
            return redirect('datasets:dataset_list')

    return redirect('datasets:dataset_list')


# ==================== REST API ENDPOINT ====================
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def api_upload_dataset_csv_view(request):
    """API endpoint to upload CSV dataset and populate EmployeeFeedback records scoped to user."""
    csv_file = request.FILES.get('file')
    if not csv_file:
        return Response({'error': 'No CSV file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    if not csv_file.name.lower().endswith('.csv'):
        return Response({'error': 'Uploaded file must be a .csv file.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = request.user
        metadata, _ = DatasetMetadata.objects.get_or_create(
            owner=user,
            defaults={
                'name': f"{user.username}'s Feedback Dataset",
                'slug': f"user-{user.id}-feedback",
                'description': f"Uploaded feedback dataset for {user.username}"
            }
        )
        created_count = _parse_and_import_csv(csv_file, metadata)
        return Response({
            'success': True,
            'count': created_count,
            'message': f"Successfully uploaded '{csv_file.name}' and imported {created_count} feedback records."
        })

    except ValueError as ve:
        return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f"Error processing CSV file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
