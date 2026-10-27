from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

# Views for template rendering (backwards compatibility)
from apps.search.views import search_dashboard_view, api_search_view, api_save_query_view, export_results_csv
from apps.core.views import dashboard_overview_view, settings_view, api_dashboard_overview, api_settings
from apps.analytics.views import (
    saved_queries_view,
    query_history_view,
    api_analytics_overview,
    api_saved_queries_view,
    api_query_history_view,
)
from apps.authentication.views import api_login, api_register, api_logout, api_user
from apps.connections.views import api_connections_view
from apps.datasets.views import (
    EmployeeFeedbackViewSet,
    DatasetMetadataViewSet,
    api_upload_dataset_csv_view,
)
from rest_framework.routers import DefaultRouter


api_datasets_router = DefaultRouter()
api_datasets_router.register(r'records', EmployeeFeedbackViewSet, basename='api-feedback-records')
api_datasets_router.register(r'metadata', DatasetMetadataViewSet, basename='api-dataset-metadata')

urlpatterns = [
    # ==================== Unified REST API Layer ====================
    # 1. Authentication APIs
    path('api/auth/register/', api_register, name='api_auth_register'),
    path('api/auth/login/', api_login, name='api_auth_login'),
    path('api/auth/logout/', api_logout, name='api_auth_logout'),
    path('api/auth/me/', api_user, name='api_auth_me'),
    path('api/auth/user/', api_user, name='api_auth_user'),
    path('auth/', include('apps.authentication.urls')),

    # 2. Search APIs
    path('api/search/', api_search_view, name='api_search'),
    path('api/search/save-query/', api_save_query_view, name='api_search_save_query'),
    path('api/search/export/', export_results_csv, name='api_search_export'),

    # 3. Executive Dashboard Overview API
    path('api/dashboard/', api_dashboard_overview, name='api_dashboard'),
    path('api/dashboard/overview/', api_dashboard_overview, name='api_dashboard_overview'),

    # 4. Saved Queries APIs
    path('api/saved-queries/', api_saved_queries_view, name='api_saved_queries'),
    path('api/saved-queries/<int:query_id>/', api_saved_queries_view, name='api_saved_query_detail'),

    # 5. Datasets APIs (/api/datasets/records/, /api/datasets/metadata/, /api/datasets/upload/)
    path('api/datasets/upload/', api_upload_dataset_csv_view, name='api_datasets_upload'),
    path('api/datasets/', include(api_datasets_router.urls)),

    # 6. Analytics APIs
    path('api/analytics/', api_analytics_overview, name='api_analytics'),
    path('api/analytics/overview/', api_analytics_overview, name='api_analytics_overview'),

    # 7. Query History APIs
    path('api/history/', api_query_history_view, name='api_history'),

    # 8. Integrations & PostgreSQL Connections APIs
    path('api/integrations/', api_connections_view, name='api_integrations'),
    path('api/connections/', api_connections_view, name='api_connections'),

    # 9. Developer Settings API
    path('api/settings/', api_settings, name='api_settings'),


    # ==================== Legacy Template Routes ====================
    path('', search_dashboard_view, name='home'),
    path('search/', include('apps.search.urls')),
    path('dashboard/', dashboard_overview_view, name='dashboard_overview'),
    path('saved-queries/', saved_queries_view, name='saved_queries'),
    path('datasets/', include('apps.datasets.urls')),
    path('analytics/', include('apps.analytics.urls')),
    path('history/', query_history_view, name='history'),
    path('integrations/', include('apps.connections.urls')),
    path('connections/', RedirectView.as_view(url='/integrations/', permanent=False)),
    path('settings/', settings_view, name='settings'),
    path('admin/', admin.site.urls),
]

