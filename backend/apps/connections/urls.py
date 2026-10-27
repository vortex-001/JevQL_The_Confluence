from django.urls import path
from . import views

app_name = 'connections'

urlpatterns = [
    path('', views.connections_index_view, name='index'),
    path('api/', views.api_connections_view, name='api_connections'),
]
