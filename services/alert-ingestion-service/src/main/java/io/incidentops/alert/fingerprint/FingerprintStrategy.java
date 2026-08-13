package io.incidentops.alert.fingerprint;

import java.util.Map;

/** One strategy per monitoring tool for deriving a stable identity for "the same alert
 *  firing again" from its raw webhook payload — used by the ingest-time dedup/occurrence
 *  tracking in {@code AlertIngestionServiceImpl}. {@link #type()} is stored alongside the
 *  computed fingerprint so a responder can see *how* an alert was deduped. */
public interface FingerprintStrategy {
    boolean supports(String source);

    String fingerprint(String orgId, Map<String, Object> raw);

    /** Short, stable label describing this strategy's key, e.g. {@code "monitor_id"} —
     *  surfaced to the frontend as {@code fingerprintType} for debugging dedup behavior. */
    String type();
}
