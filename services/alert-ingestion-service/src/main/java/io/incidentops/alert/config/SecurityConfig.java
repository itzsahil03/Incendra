package io.incidentops.alert.config;

import io.incidentops.alert.client.OrgClient;
import io.incidentops.alert.security.HmacFilter;
import io.incidentops.alert.security.JwtFilter;
import io.incidentops.common.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public JwtUtil jwtUtil(@Value("${JWT_SECRET}") String secret) {
        return new JwtUtil(secret);
    }

    /** /api/webhooks/** is intentionally permitAll at the Spring Security layer — the two
     *  filters added below are the real gates for it and reject with 401 before this chain
     *  would: HmacFilter for the POST ingestion path (a monitoring tool's signed payload,
     *  no OAuth flow), JwtFilter for the GET read endpoints (real end-user requests). Each
     *  filter only acts on its own HTTP method, so they never contend over the same request. */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, OrgClient orgClient, JwtUtil jwtUtil) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/webhooks/**", "/actuator/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(new HmacFilter(orgClient), UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new JwtFilter(jwtUtil), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
