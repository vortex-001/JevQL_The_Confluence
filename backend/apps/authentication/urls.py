from django.urls import path
from . import views

app_name = 'authentication'

urlpatterns = [
    # Template auth views
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),

    # REST API endpoints
    path('api/login/', views.api_login, name='api_login'),
    path('api/register/', views.api_register, name='api_register'),
    path('api/logout/', views.api_logout, name='api_logout'),
    path('api/user/', views.api_user, name='api_user'),
]
