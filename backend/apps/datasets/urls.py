from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DatasetListView,
    EmployeeFeedbackViewSet,
    DatasetMetadataViewSet,
    upload_dataset_csv_view,
    api_upload_dataset_csv_view,
)


app_name = 'datasets'

router = DefaultRouter()
router.register(r'api/records', EmployeeFeedbackViewSet, basename='feedback-record')
router.register(r'api/metadata', DatasetMetadataViewSet, basename='dataset-metadata')

urlpatterns = [
    path('', DatasetListView.as_view(), name='dataset_list'),
    path('upload/', upload_dataset_csv_view, name='upload_dataset'),
    path('api/upload/', api_upload_dataset_csv_view, name='api_upload_dataset'),
    path('', include(router.urls)),
]
