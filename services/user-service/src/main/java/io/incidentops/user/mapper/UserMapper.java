package io.incidentops.user.mapper;

import io.incidentops.user.dto.response.UserResponse;
import io.incidentops.user.entity.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {
    public UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getEmail(), u.getName(), u.getOrgId(), u.getRole().name(),
                u.getNotificationPrefs(), u.getCreatedAt(), u.isActive());
    }
}
