FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY auditor-service/pom.xml ./auditor-service/pom.xml
COPY auditor-service/src ./auditor-service/src
WORKDIR /build/auditor-service
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/auditor-service/target/*.jar app.jar
EXPOSE 8100
ENTRYPOINT ["java","-jar","app.jar"]
