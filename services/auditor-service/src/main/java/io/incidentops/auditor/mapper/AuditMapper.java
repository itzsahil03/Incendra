package io.incidentops.auditor.mapper;

import io.incidentops.auditor.dto.response.AuditRecordResponse;
import io.incidentops.auditor.entity.AuditRecord;
import org.springframework.stereotype.Component;

@Component
public class AuditMapper {
    public AuditRecordResponse toResponse(AuditRecord r) {
        return new AuditRecordResponse(r.getAuditId(), r.getOrgId(), r.getService(), r.getAction(),
                r.getEntityType(), r.getEntityId(), r.getActorId(), r.getOccurredAt(), r.getDetails());
    }
}
