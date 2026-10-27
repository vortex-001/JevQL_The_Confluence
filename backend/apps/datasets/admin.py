from django.contrib import admin
from .models import EmployeeFeedback, DatasetMetadata

@admin.register(DatasetMetadata)
class DatasetMetadataAdmin(admin.ModelAdmin):
    list_display = ('name', 'total_records', 'is_active', 'updated_at')
    search_fields = ('name', 'description')

@admin.register(EmployeeFeedback)
class EmployeeFeedbackAdmin(admin.ModelAdmin):
    list_display = ('anonymized_id', 'department', 'role', 'rating', 'sentiment', 'submission_date')
    list_filter = ('department', 'sentiment', 'rating', 'submission_date')
    search_fields = ('anonymized_id', 'role', 'feedback_text')
    ordering = ('-submission_date',)
