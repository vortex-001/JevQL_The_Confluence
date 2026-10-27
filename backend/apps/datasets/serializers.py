from rest_framework import serializers
from .models import EmployeeFeedback, DatasetMetadata

class DatasetMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatasetMetadata
        fields = '__all__'
        read_only_fields = ['owner']

class EmployeeFeedbackSerializer(serializers.ModelSerializer):
    avatar_initial = serializers.ReadOnlyField()

    class Meta:
        model = EmployeeFeedback
        fields = [
            'id',
            'anonymized_id',
            'employee_name',
            'avatar_initial',
            'department',
            'role',
            'rating',
            'sentiment',
            'workload_level',
            'feedback_text',
            'tags',
            'submission_date',
            'created_at',
        ]
