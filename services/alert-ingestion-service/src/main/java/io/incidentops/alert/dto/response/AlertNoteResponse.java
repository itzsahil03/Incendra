package io.incidentops.alert.dto.response;

import java.time.Instant;

public record AlertNoteResponse(String id, String authorId, String authorName, String text, Instant createdAt) {}
