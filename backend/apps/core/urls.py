from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('dashboard/', views.dashboard_overview_view, name='dashboard_overview'),
    path('settings/', views.settings_view, name='settings'),
]
