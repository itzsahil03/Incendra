package io.incidentops.incident.service;

import io.incidentops.incident.entity.IncidentCounter;
import io.incidentops.incident.repository.IncidentCounterRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Mints sequential, human-readable incident ids (INC000001, INC000002, ...) — one
 *  counter per org. {@code synchronized} is enough correctness here: this service runs
 *  as a single instance, not horizontally scaled, so a JVM-local lock serializes
 *  concurrent creates without needing a distributed lock or DB-level row locking. */
@Component
public class IncidentIdGenerator {
    private final IncidentCounterRepository repo;

    public IncidentIdGenerator(IncidentCounterRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public synchronized String next(String orgId) {
        var counter = repo.findById(orgId).orElseGet(() -> new IncidentCounter(orgId, 1L));
        long value = counter.getNextValue();
        counter.setNextValue(value + 1);
        repo.save(counter);
        return "INC" + String.format("%06d", value);
    }
}
