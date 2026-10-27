from django.urls import path
from . import views

app_name = 'search'

urlpatterns = [
    path('', views.search_dashboard_view, name='dashboard'),
    path('save-query/', views.save_query_view, name='save_query'),
    path('export/', views.export_results_csv, name='export_csv'),
    path('api/', views.api_search_view, name='api_search'),
    path('api/save-query/', views.api_save_query_view, name='api_save_query'),
]
