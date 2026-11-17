import json
from app.services.evaluation import run_retrieval_evaluation

if __name__ == "__main__":
    results = run_retrieval_evaluation()
    summaries = [item for item in results if item.get("summary")]

    print(json.dumps(summaries, indent=2))
    print("Full results saved to evaluation/v1-results.json")
