FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY workflow-service/pom.xml ./workflow-service/pom.xml
COPY workflow-service/src ./workflow-service/src
WORKDIR /build/workflow-service
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/workflow-service/target/*.jar app.jar
EXPOSE 8096
ENTRYPOINT ["java","-jar","app.jar"]