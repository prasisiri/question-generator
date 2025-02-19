#!/bin/bash

# Login to OpenShift (you'll need to modify these values)
# oc login --token=<your-token> --server=<your-server>

# Select your project
# oc project <your-project>

# Build the image
oc new-build --name=question-generator --binary --strategy=docker

# Start the build using local directory
oc start-build question-generator --from-dir=. --follow

# Apply the deployment configurations
oc apply -f openshift/deployment.yaml
oc apply -f openshift/service.yaml
oc apply -f openshift/route.yaml

# Wait for deployment to complete
oc rollout status deployment/question-generator 