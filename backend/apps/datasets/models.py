from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Department(models.TextChoices):
    ENGINEERING = 'Engineering', 'Engineering'
    PRODUCT = 'Product', 'Product'
    SALES = 'Sales', 'Sales'
    MARKETING = 'Marketing', 'Marketing'
    CUSTOMER_SUCCESS = 'Customer Success', 'Customer Success'
    HR = 'Human Resources', 'Human Resources'
    FINANCE = 'Finance', 'Finance'
    OPERATIONS = 'Operations', 'Operations'

class Sentiment(models.TextChoices):
    POSITIVE = 'Positive', 'Positive'
    NEUTRAL = 'Neutral', 'Neutral'
    NEGATIVE = 'Negative', 'Negative'

from django.conf import settings

class DatasetMetadata(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='datasets',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=120, default='Employee Feedback')
    slug = models.SlugField(max_length=120, default='employee-feedback')
    description = models.TextField(blank=True, default='Internal synthetic employee quarterly survey and feedback dataset.')
    total_records = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Dataset Metadata'
        verbose_name_plural = 'Dataset Metadata'
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'slug'],
                name='unique_owner_dataset_slug',
                condition=models.Q(owner__isnull=False)
            )
        ]

    def __str__(self):
        owner_name = self.owner.username if self.owner else 'Public Demo'
        return f"{self.name} [{owner_name}] ({self.total_records} records)"

class EmployeeFeedback(models.Model):
    dataset = models.ForeignKey(
        DatasetMetadata,
        on_delete=models.CASCADE,
        related_name='records',
        null=True,
        blank=True
    )
    anonymized_id = models.CharField(
        max_length=32,
        db_index=True,
        help_text="Synthetic anonymized employee identifier (e.g. EMP-1042)"
    )
    department = models.CharField(
        max_length=50,
        choices=Department.choices,
        db_index=True
    )
    role = models.CharField(
        max_length=100,
        db_index=True
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        db_index=True,
        help_text="Rating on a 1-5 scale"
    )
    sentiment = models.CharField(
        max_length=20,
        choices=Sentiment.choices,
        db_index=True
    )
    feedback_text = models.TextField(
        help_text="Natural-language feedback comments from the employee"
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Extracted themes or categories (e.g., ['tooling', 'management', 'work-life'])"
    )
    employee_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Synthetic employee name (e.g. Riya Sharma)"
    )
    workload_level = models.CharField(
        max_length=20,
        choices=[('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')],
        default='Medium',
        db_index=True,
        help_text="Estimated workload intensity (High/Medium/Low)"
    )
    submission_date = models.DateField(
        db_index=True,
        help_text="Date feedback was submitted"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def avatar_initial(self):
        if self.employee_name and self.employee_name.strip():
            return self.employee_name.strip()[0].upper()
        return self.role[0].upper() if self.role else 'E'

    class Meta:
        verbose_name = 'Employee Feedback Record'
        verbose_name_plural = 'Employee Feedback Records'
        ordering = ['-submission_date', '-id']
        indexes = [
            models.Index(fields=['department', 'rating']),
            models.Index(fields=['department', 'sentiment']),
            models.Index(fields=['submission_date', 'rating']),
        ]

    def get_embedding_text(self) -> str:
        """Returns the canonical text used for semantic embedding indexing."""
        tags_str = ", ".join(self.tags) if self.tags else ""
        return f"Department: {self.department}. Role: {self.role}. Feedback: {self.feedback_text}. Tags: {tags_str}"

    def __str__(self):
        return f"[{self.department}] {self.role} - {self.sentiment} ({self.rating}/5)"


class RecordEmbedding(models.Model):
    """
    Persistent embedding cache for employee feedback records.
    Uses SHA-256 content hashing to avoid redundant API calls.
    """
    feedback = models.OneToOneField(
        EmployeeFeedback,
        on_delete=models.CASCADE,
        related_name='embedding'
    )
    content_hash = models.CharField(max_length=64, db_index=True)
    model_version = models.CharField(max_length=64, default='text-embedding-004')
    embedding = models.JSONField(help_text="List of float values for the embedding vector")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Record Embedding'
        verbose_name_plural = 'Record Embeddings'
        indexes = [
            models.Index(fields=['content_hash', 'model_version']),
        ]

    def __str__(self):
        return f"Embedding for {self.feedback.anonymized_id} ({self.model_version})"

