package io.incidentops.auditor.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** One row per user's bookmark of an audit event — backs the Activity page's per-row
 *  bookmark toggle and "Recent Bookmarks" widget, persisted so it survives a refresh. */
@Document("activity_bookmarks")
@CompoundIndexes({
        // Uniqueness (one bookmark per user per audit event) and the "is this row already
        // bookmarked" lookup both key off all three fields together.
        @CompoundIndex(name = "org_user_audit", def = "{'orgId': 1, 'userId': 1, 'auditId': 1}", unique = true),
        // "Recent Bookmarks" widget: this user's bookmarks, newest first.
        @CompoundIndex(name = "org_user_createdAt", def = "{'orgId': 1, 'userId': 1, 'createdAt': -1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ActivityBookmark {
    @Id private String id;
    private String orgId;
    private String userId;
    private String auditId;
    private Instant createdAt;
}
