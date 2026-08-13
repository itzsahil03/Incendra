FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY alert-ingestion-service/pom.xml ./alert-ingestion-service/pom.xml
COPY alert-ingestion-service/src ./alert-ingestion-service/src
WORKDIR /build/alert-ingestion-service
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/alert-ingestion-service/target/*.jar app.jar
EXPOSE 8094
ENTRYPOINT ["java","-jar","app.jar"]