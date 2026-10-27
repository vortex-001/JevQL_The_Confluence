from django.shortcuts import render
from django.conf import settings
from django.db.models import Q
from apps.datasets.models import EmployeeFeedback, DatasetMetadata
from apps.analytics.models import QueryHistory, SavedQuery
from apps.connections.security import get_connection_from_session, mask_connection_info
from apps.semantic.factory import get_semantic_provider
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response


def dashboard_overview_view(request):
    """Executive database overview for the 'Dashboard' navigation item."""
    custom_conn = get_connection_from_session(request)
    if request.user.is_authenticated:
        total_records = EmployeeFeedback.objects.filter(dataset__owner=request.user).count()
        recent_history = QueryHistory.objects.filter(user=request.user).order_by('-created_at')[:5]
        saved_count = SavedQuery.objects.filter(user=request.user).count()
    else:
        total_records = EmployeeFeedback.objects.filter(Q(dataset__owner__isnull=True) | Q(dataset__isnull=True)).count()
        recent_history = QueryHistory.objects.filter(user__isnull=True).order_by('-created_at')[:5]
        saved_count = SavedQuery.objects.filter(user__isnull=True).count()

    provider = get_semantic_provider()

    context = {
        'total_records': total_records,
        'saved_count': saved_count,
        'recent_history': recent_history,
        'provider_name': provider.get_provider_name(),
        'provider_available': provider.is_available(),
        'active_conn': mask_connection_info(custom_conn),
    }
    return render(request, 'dashboard/overview.html', context)


def settings_view(request):
    """System configuration and integrations status."""
    custom_conn = get_connection_from_session(request)
    provider = get_semantic_provider()

    db_conf = settings.DATABASES['default']
    masked_db = {
        'ENGINE': db_conf.get('ENGINE'),
        'NAME': db_conf.get('NAME'),
        'USER': db_conf.get('USER'),
        'HOST': db_conf.get('HOST'),
        'PORT': db_conf.get('PORT'),
    }

    context = {
        'db_conf': masked_db,
        'provider_name': provider.get_provider_name(),
        'has_gemini_key': bool(getattr(settings, 'GEMINI_API_KEY', '')),
        'timeout_seconds': getattr(settings, 'SEMANTIC_TIMEOUT_SECONDS', 5.0),
        'candidate_limit': getattr(settings, 'SEMANTIC_CANDIDATE_LIMIT', 30),
        'active_conn': mask_connection_info(custom_conn),
    }
    return render(request, 'settings/index.html', context)


# ==================== REST API ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_dashboard_overview(request):
    """REST API endpoint for executive dashboard overview strictly scoped to authenticated user."""
    custom_conn = get_connection_from_session(request)
    total_records = EmployeeFeedback.objects.filter(dataset__owner=request.user).count()
    recent_history = QueryHistory.objects.filter(user=request.user).order_by('-created_at')[:5]
    saved_count = SavedQuery.objects.filter(user=request.user).count()
    provider = get_semantic_provider()

    history_data = [{
        'id': h.id,
        'query_text': h.query_text,
        'duration_ms': h.duration_ms,
        'result_count': h.result_count,
        'source': h.source,
        'search_mode': h.search_mode,
        'timestamp': h.created_at.strftime('%b %d, %H:%M') if h.created_at else ''
    } for h in recent_history]

    return Response({
        'total_records': total_records,
        'saved_count': saved_count,
        'recent_history': history_data,
        'provider_name': provider.get_provider_name(),
        'provider_available': provider.is_available(),
        'active_conn': mask_connection_info(custom_conn),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def api_settings(request):
    """REST API endpoint for developer settings and engine status."""
    custom_conn = get_connection_from_session(request)
    provider = get_semantic_provider()

    db_conf = settings.DATABASES['default']
    masked_db = {
        'ENGINE': db_conf.get('ENGINE'),
        'NAME': db_conf.get('NAME'),
        'USER': db_conf.get('USER'),
        'HOST': db_conf.get('HOST'),
        'PORT': db_conf.get('PORT'),
    }

    return Response({
        'db_conf': masked_db,
        'provider_name': provider.get_provider_name(),
        'has_gemini_key': bool(getattr(settings, 'GEMINI_API_KEY', '')),
        'timeout_seconds': getattr(settings, 'SEMANTIC_TIMEOUT_SECONDS', 5.0),
        'candidate_limit': getattr(settings, 'SEMANTIC_CANDIDATE_LIMIT', 30),
        'active_conn': mask_connection_info(custom_conn),
    })
