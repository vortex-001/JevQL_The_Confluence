from django.urls import path
from . import views

app_name = 'analytics'

urlpatterns = [
    # Legacy template routes
    path('', views.analytics_overview_view, name='overview'),
    path('saved-queries/', views.saved_queries_view, name='saved_queries'),
    path('history/', views.query_history_view, name='history'),

    # REST API endpoints
    path('api/overview/', views.api_analytics_overview, name='api_overview'),
    path('api/saved-queries/', views.api_saved_queries_view, name='api_saved_queries'),
    path('api/saved-queries/<int:query_id>/', views.api_saved_queries_view, name='api_saved_query_detail'),
    path('api/history/', views.api_query_history_view, name='api_history'),
]
