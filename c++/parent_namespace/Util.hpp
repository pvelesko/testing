class TestBase {
  public:
  int a;
};



template<class T>
class TestChild : public TestBase {
  public:
  TestChild(int num);
};
#include "Util.tpp"
