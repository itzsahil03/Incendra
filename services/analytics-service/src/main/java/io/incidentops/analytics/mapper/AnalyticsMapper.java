package io.incidentops.analytics.mapper;

import io.incidentops.analytics.dto.response.AssigneeStat;
import io.incidentops.analytics.dto.response.MetricsSummaryResponse;
import io.incidentops.analytics.dto.response.TrendPoint;
import io.incidentops.analytics.entity.IncidentFact;
import io.incidentops.analytics.entity.MetricsSnapshot;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Builds the metrics summary from projected {@link IncidentFact}s. "open" and
 *  {@code byStatus} are driven by workflow-service's real state machine (see
 *  {@code client.TerminalStateResolver}) instead of hardcoded strings. All "today"/
 *  day-bucketed fields use UTC day boundaries — this is a single-process demo service,
 *  not something that needs per-org timezone awareness. */
@Component
public class AnalyticsMapper {

    private static final List<String> PRIORITIES = List.of("P1", "P2", "P3", "P4");
    private static final List<String> RESOLUTION_BUCKETS = List.of("0-15m", "15-30m", "30-60m", "1-2h", "2h+");
    private static final int VOLUME_HISTORY_DAYS = 90;

    public MetricsSummaryResponse toMetricsSummary(String orgId, List<IncidentFact> facts, List<String> allStates,
                                                    Set<String> terminalStates, List<MetricsSnapshot> recentSnapshotsDesc) {
        long total = facts.size();
        long open = facts.stream()
                .filter(f -> !terminalStates.contains(f.getStatus()))
                .count();

        var byPriority = new HashMap<String, Long>();
        for (String s : PRIORITIES) byPriority.put(s, 0L);
        for (IncidentFact f : facts) {
            if (f.getPriority() != null) byPriority.merge(f.getPriority(), 1L, Long::sum);
        }

        var byStatus = new HashMap<String, Long>();
        for (String s : allStates) byStatus.put(s, 0L);
        for (IncidentFact f : facts) {
            if (f.getStatus() != null) byStatus.merge(f.getStatus(), 1L, Long::sum);
        }

        var byPriorityStatus = new HashMap<String, Map<String, Long>>();
        for (String s : PRIORITIES) {
            var row = new HashMap<String, Long>();
            for (String st : allStates) row.put(st, 0L);
            byPriorityStatus.put(s, row);
        }
        for (IncidentFact f : facts) {
            if (f.getPriority() == null || f.getStatus() == null) continue;
            byPriorityStatus.computeIfAbsent(f.getPriority(), k -> new HashMap<>())
                    .merge(f.getStatus(), 1L, Long::sum);
        }

        double mttrMin = average(facts.stream()
                .filter(f -> f.getResolvedAt() != null)
                .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getResolvedAt()).toSeconds()));

        double mttaMin = average(facts.stream()
                .filter(f -> f.getAcknowledgedAt() != null)
                .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getAcknowledgedAt()).toSeconds()));

        Instant startOfToday = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
        double mttrTodayMin = average(facts.stream()
                .filter(f -> f.getResolvedAt() != null && !f.getResolvedAt().isBefore(startOfToday))
                .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getResolvedAt()).toSeconds()));
        double mttaTodayMin = average(facts.stream()
                .filter(f -> f.getAcknowledgedAt() != null && !f.getAcknowledgedAt().isBefore(startOfToday))
                .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getAcknowledgedAt()).toSeconds()));

        var dateFmt = DateTimeFormatter.ISO_LOCAL_DATE;
        Instant volumeCutoff = startOfToday.minus(java.time.Duration.ofDays(VOLUME_HISTORY_DAYS));
        var volumeByDay = new HashMap<String, Long>();
        var peakHours = new HashMap<String, Long>();
        for (String h : List.of("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
                "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23")) {
            peakHours.put(h, 0L);
        }
        for (IncidentFact f : facts) {
            if (f.getCreatedAt() == null) continue;
            var utc = f.getCreatedAt().atZone(ZoneOffset.UTC);
            peakHours.merge(String.valueOf(utc.getHour()), 1L, Long::sum);
            if (!f.getCreatedAt().isBefore(volumeCutoff)) {
                volumeByDay.merge(utc.toLocalDate().format(dateFmt), 1L, Long::sum);
            }
        }

        var resolutionTimeBuckets = new HashMap<String, Long>();
        for (String b : RESOLUTION_BUCKETS) resolutionTimeBuckets.put(b, 0L);
        for (IncidentFact f : facts) {
            if (f.getResolvedAt() == null) continue;
            long minutes = Duration.between(f.getCreatedAt(), f.getResolvedAt()).toMinutes();
            resolutionTimeBuckets.merge(resolutionBucket(minutes), 1L, Long::sum);
        }

        var byAssignee = facts.stream()
                .filter(f -> f.getResolvedAt() != null)
                .collect(Collectors.groupingBy(f -> f.getAssigneeName() != null ? f.getAssigneeName() : "Unassigned"))
                .entrySet().stream()
                .map(entry -> {
                    var group = entry.getValue();
                    double avgMttr = average(group.stream()
                            .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getResolvedAt()).toSeconds()));
                    double avgMtta = average(group.stream()
                            .filter(f -> f.getAcknowledgedAt() != null)
                            .mapToLong(f -> Duration.between(f.getCreatedAt(), f.getAcknowledgedAt()).toSeconds()));
                    return new AssigneeStat(entry.getKey(), group.size(), avgMttr, avgMtta);
                })
                .sorted(Comparator.comparing(AssigneeStat::resolvedCount).reversed())
                .toList();

        var trend = recentSnapshotsDesc.stream()
                .sorted(Comparator.comparing(MetricsSnapshot::getGeneratedAt))
                .map(s -> new TrendPoint(s.getGeneratedAt().toString(), s.getTotalIncidents(), s.getOpenIncidents(),
                        s.getMttrMinutes(), s.getMttaMinutes()))
                .toList();

        return new MetricsSummaryResponse(
                orgId, total, open, total - open,
                round2(mttrMin), round2(mttaMin), round2(mttrTodayMin), round2(mttaTodayMin),
                byPriority, byStatus, byPriorityStatus,
                volumeByDay, peakHours, resolutionTimeBuckets, byAssignee,
                trend, Instant.now().toString());
    }

    private static String resolutionBucket(long minutes) {
        if (minutes <= 15) return "0-15m";
        if (minutes <= 30) return "15-30m";
        if (minutes <= 60) return "30-60m";
        if (minutes <= 120) return "1-2h";
        return "2h+";
    }

    private static double average(java.util.stream.LongStream seconds) {
        return round2(seconds.average().orElse(0) / 60.0);
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    /** Same fields, as a Map — used for the MetricsGenerated Kafka payload, which must
     *  keep its exact original key set (plus every field EVENTS.md documents). */
    public Map<String, Object> toMetricsPayload(MetricsSummaryResponse r) {
        var m = new HashMap<String, Object>();
        m.put("orgId", r.orgId());
        m.put("totalIncidents", r.totalIncidents());
        m.put("openIncidents", r.openIncidents());
        m.put("resolvedIncidents", r.resolvedIncidents());
        m.put("mttrMinutes", r.mttrMinutes());
        m.put("mttaMinutes", r.mttaMinutes());
        m.put("mttrTodayMinutes", r.mttrTodayMinutes());
        m.put("mttaTodayMinutes", r.mttaTodayMinutes());
        m.put("byPriority", r.byPriority());
        m.put("byStatus", r.byStatus());
        m.put("byPriorityStatus", r.byPriorityStatus());
        m.put("volumeByDay", r.volumeByDay());
        m.put("peakHours", r.peakHours());
        m.put("resolutionTimeBuckets", r.resolutionTimeBuckets());
        m.put("byAssignee", r.byAssignee());
        m.put("trend", r.trend());
        m.put("generatedAt", r.generatedAt());
        return m;
    }
}
