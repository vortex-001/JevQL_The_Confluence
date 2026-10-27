from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token

from django.views.decorators.csrf import ensure_csrf_cookie

def login_view(request):
    """Legacy template login view."""
    return render(request, 'auth/login.html')

def signup_view(request):
    """Legacy template signup view."""
    return render(request, 'auth/signup.html')

@api_view(['POST'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def api_login(request):
    """
    Authenticate a user with username (or email) and password.
    Returns the auth token and user profile info.
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response(
            {'error': 'Please provide both username and password.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Support login with either username or email
    user = authenticate(request, username=username, password=password)
    if user is None and '@' in username:
        try:
            matched_user = User.objects.get(email__iexact=username)
            user = authenticate(request, username=matched_user.username, password=password)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            user = None

    if user is not None:
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        return Response({
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'name': full_name,
                'is_staff': user.is_staff,
            }
        })
    else:
        return Response(
            {'error': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    """
    Register a new user, automatically logs them in, and returns an auth token.
    """
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name = request.data.get('last_name', '').strip()

    if not username:
        return Response({'error': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': f"Username '{username}' is already taken."}, status=status.HTTP_400_BAD_REQUEST)

    if email and User.objects.filter(email__iexact=email).exists():
        return Response({'error': f"An account with email '{email}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )

    login(request, user)
    token, _ = Token.objects.get_or_create(user=user)
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username

    return Response({
        'token': token.key,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'name': full_name,
            'is_staff': user.is_staff,
        }
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def api_logout(request):
    """
    Log out the user, invalidate their auth token and session.
    """
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
        logout(request)
    return Response({'message': 'Logged out successfully.'})

@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def api_user(request):
    """
    Get information about the currently authenticated user.
    """
    if request.user.is_authenticated:
        user = request.user
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username
        return Response({
            'is_authenticated': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'name': full_name,
                'is_staff': user.is_staff,
            }
        })
    return Response({
        'is_authenticated': False,
        'user': None
    })
