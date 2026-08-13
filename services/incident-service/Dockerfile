FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY incident-service/pom.xml ./incident-service/pom.xml
COPY incident-service/src ./incident-service/src
WORKDIR /build/incident-service
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/incident-service/target/*.jar app.jar
EXPOSE 8095
ENTRYPOINT ["java","-jar","app.jar"]