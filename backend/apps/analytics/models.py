from django.db import models
from django.conf import settings

class SavedQuery(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_queries',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=150, help_text="Friendly label for the saved query")
    query_text = models.TextField(help_text="The natural-language search query")
    filters = models.JSONField(default=dict, blank=True, help_text="Department, sentiment, rating, or custom filters")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Saved Query"
        verbose_name_plural = "Saved Queries"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ('{self.query_text[:40]}...')"

class QueryHistory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='query_history',
        null=True,
        blank=True
    )
    query_text = models.TextField(help_text="The executed natural language query")
    duration_ms = models.FloatField(default=0.0, help_text="Measured latency in milliseconds")
    result_count = models.PositiveIntegerField(default=0, help_text="Number of records returned")
    source = models.CharField(max_length=150, default='jevql_db (Demo)', help_text="Database / table queried")
    search_mode = models.CharField(max_length=100, default='Structured & Trigram', help_text="Engine mode")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Query History Record"
        verbose_name_plural = "Query History Records"
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] '{self.query_text[:30]}' ({self.duration_ms}ms, {self.result_count} rows)"
