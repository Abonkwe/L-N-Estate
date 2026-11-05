"""Audit log inspection endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user

router = APIRouter(prefix="/audit-log", tags=["audit"], dependencies=[Depends(current_user)])


@router.get("", response_model=list[s.AuditLogOut])
def list_audit_logs(
    entity_type: str | None = Query(None, description="Filter by entity type (e.g. payment, lease, expense)"),
    action: str | None = Query(None, description="Filter by action (e.g. payment.void, lease.create)"),
    source: str | None = Query(None, description="Filter by source (web, whatsapp, system)"),
    limit: int = Query(100, ge=1, le=500, description="Max audit logs to return"),
    db: Session = Depends(get_db),
) -> list[s.AuditLogOut]:
    """
    List historical audit log entries (FR-A3, Acceptance Criterion 8).
    Tracks who changed what, when, and whether it came from the web app or WhatsApp.
    """
    query = select(m.AuditLog).order_by(m.AuditLog.at.desc(), m.AuditLog.id.desc()).limit(limit)
    if entity_type:
        query = query.where(m.AuditLog.entity_type == entity_type)
    if action:
        query = query.where(m.AuditLog.action == action)
    if source:
        query = query.where(m.AuditLog.source == source)

    return list(db.scalars(query))

