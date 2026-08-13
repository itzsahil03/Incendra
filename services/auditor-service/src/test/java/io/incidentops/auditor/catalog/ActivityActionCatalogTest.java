package io.incidentops.auditor.catalog;

import io.incidentops.auditor.catalog.ActivityActionCatalog.Category;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityActionCatalogTest {

    @Test
    void lookup_knownAction_returnsItsCatalogedDisplayNameAndCategory() {
        var info = ActivityActionCatalog.lookup("INCIDENT_CREATED");

        assertThat(info.displayName()).isEqualTo("Incident Created");
        assertThat(info.category()).isEqualTo(Category.INCIDENT);
    }

    @Test
    void lookup_unrecognizedAction_fallsBackToHumanizedNameAndSystemCategoryRatherThanThrowing() {
        var info = ActivityActionCatalog.lookup("SOME_FUTURE_ACTION_NOT_YET_CATALOGED");

        assertThat(info.category()).isEqualTo(Category.SYSTEM);
        assertThat(info.displayName()).isEqualTo("Some future action not yet cataloged");
    }

    @Test
    void actionsForCategory_system_isEmptyByDesign() {
        // SYSTEM is "everything not in the other 4 named categories" — not an
        // enumerable list of its own, see knownActions().
        assertThat(ActivityActionCatalog.actionsForCategory(Category.SYSTEM)).isEmpty();
    }

    @Test
    void actionsForCategory_incident_containsIncidentCreatedButNotAlertActions() {
        var incidentActions = ActivityActionCatalog.actionsForCategory(Category.INCIDENT);

        assertThat(incidentActions).contains("INCIDENT_CREATED", "PRIORITY_UPDATED");
        assertThat(incidentActions).doesNotContain("ALERT_INGESTED");
    }

    @Test
    void knownActions_doesNotContainAnUncatalogedAction() {
        assertThat(ActivityActionCatalog.knownActions()).doesNotContain("SOME_FUTURE_ACTION_NOT_YET_CATALOGED");
    }
}
